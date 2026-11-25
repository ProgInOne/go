import {
  expectedFromObservation,
  parseSpec,
  type PredictObservation,
  type PredictOutputSpec,
} from '@proginone/exercise-kit';
import type { GoRunner, GoRunResult } from '@proginone/go-runner';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { CheckResult } from './check.ts';
import {
  emptyStore,
  EXPECTATIONS_FILE,
  predictInputHash,
  serializeExpectations,
  writeExpectations,
  type ExpectationStore,
} from './expectations.ts';

/** One lesson example as the run check sees it. */
interface ExampleJob {
  file: string;
  /** `<lesson id>#<example id>`, as in messages. */
  id: string;
  line: number | null;
  code: string;
  expectError: boolean;
}

export interface RunCheckStats {
  examples: number;
  passed: number;
  /** predict_output exercises run, and how many got an answer key. */
  predicts: number;
  predictsPassed: number;
  /** The expectation file differs from what the runs computed. */
  expectationsChanged: boolean;
  /** Written expectation file, when it changed and `frozen` was off. */
  wrote: string | null;
}

export interface RunCheckOptions {
  /** Content root, where `.generated/predict-expected.json` lives. */
  root: string;
  /** Fail instead of writing when the expectation file is out of date (CI). */
  frozen?: boolean;
}

/** Random seed for checks: the same program prints the same thing on every run. */
const SEED = 1;

const at = (job: ExampleJob) =>
  `<RunnableExample id="${job.id.split('#')[1] ?? ''}">${job.line ? ` (${String(job.line)}행)` : ''}`;

/** The source as the learner's editor gets it: the fenced block plus a final newline. */
const asFile = (code: string) => (code.endsWith('\n') ? code : `${code}\n`);

/** First line where `a` and `b` differ, 1-based. */
function firstDifference(a: string, b: string): number {
  const x = a.split('\n');
  const y = b.split('\n');
  const n = Math.max(x.length, y.length);
  for (let i = 0; i < n; i++) if (x[i] !== y[i]) return i + 1;
  return n;
}

/**
 * `content:check --run` (G-002): compiles and runs every lesson `<RunnableExample>` with the real
 * Go, the way the app does, and checks that it is gofmt-formatted. An example must run without
 * errors unless it is marked `expectError`, which must fail to compile. Drafts are included:
 * running comes before review. Problems are added to `result.diagnostics`.
 */
export async function runCheckContent(
  result: CheckResult,
  runner: Pick<GoRunner, 'run' | 'format'>,
  options: RunCheckOptions,
): Promise<RunCheckStats> {
  const diag = result.diagnostics;
  const files = new Map(
    result.source.courses.flatMap((c) =>
      c.modules.flatMap((m) => m.lessons.map((l) => [l.meta.data.id, l.mdxFile] as const)),
    ),
  );
  const jobs: ExampleJob[] = [...result.lessons].flatMap(([lessonId, compiled]) =>
    compiled.refs.examples.map((e) => ({
      file: files.get(lessonId) ?? lessonId,
      id: `${lessonId}#${e.id}`,
      line: e.line,
      code: e.code,
      expectError: e.expectError,
    })),
  );

  const outcomes = await Promise.all(
    jobs.map(async (job) => {
      const problems: string[] = [];
      const source = asFile(job.code);

      const formatted = await runner.format(source);
      if (formatted.ok) {
        if (formatted.source !== source) {
          problems.push(
            `gofmt 형식이 아닙니다(코드 ${String(firstDifference(source, formatted.source))}번째 줄부터). gofmt로 정리한 코드를 쓰세요`,
          );
        }
      } else if (formatted.reason !== 'syntax-error' || !job.expectError) {
        problems.push(
          formatted.reason === 'syntax-error'
            ? `문법 오류: ${formatted.output.split('\n')[0] ?? ''}`
            : `gofmt를 실행하지 못했습니다: ${formatted.message}`,
        );
      }

      const ran = await runner.run({
        files: [{ name: 'main.go', content: source }],
        randomSeed: SEED,
      });
      if (ran.phase === 'compile') {
        const c = ran.compile;
        if (c.reason !== 'compile-error') {
          problems.push(`컴파일하지 못했습니다(${c.reason})`);
        } else if (!job.expectError) {
          problems.push(
            `컴파일 오류가 납니다. 의도한 오류라면 expectError를 표시하세요: ${c.output.split('\n')[0] ?? ''}`,
          );
        }
      } else if (job.expectError) {
        problems.push('expectError로 표시했지만 컴파일됩니다. 표시를 지우거나 코드를 확인하세요');
      } else if (ran.run.reason !== 'exit' || ran.run.exitCode !== 0) {
        const first = ran.run.stderr.split('\n')[0] ?? '';
        problems.push(
          `오류 없이 끝나야 합니다(${ran.run.reason}, 종료 코드 ${String(ran.run.exitCode)})${first ? `: ${first}` : ''}`,
        );
      }
      return problems;
    }),
  );
  // Reported in example order, whatever order the runs finished in.
  jobs.forEach((job, i) => {
    for (const p of outcomes[i] ?? []) diag.error(job.file, `${at(job)}: ${p}`);
  });
  const predict = await runPredicts(result, runner, options);
  return {
    examples: jobs.length,
    passed: outcomes.filter((p) => p.length === 0).length,
    ...predict,
  };
}

/** How a run ended, as a predict_output answer key sees it. */
export function observationOf(result: GoRunResult): PredictObservation {
  if (result.phase === 'compile') {
    return result.compile.reason === 'compile-error'
      ? { kind: 'compile-error' }
      : { kind: 'other', reason: `compile ${result.compile.reason}` };
  }
  const { reason, exitCode, stdout } = result.run;
  if (reason === 'exit' && exitCode === 0) return { kind: 'output', stdout };
  if (reason === 'panic') return { kind: 'panic' };
  return { kind: 'other', reason: reason === 'exit' ? `종료 코드 ${String(exitCode)}` : reason };
}

const sameObservation = (a: PredictObservation, b: PredictObservation) =>
  JSON.stringify(a) === JSON.stringify(b);

/**
 * Runs every predict_output program (drafts included) and records its answer key
 * (expectations.ts). Each program runs twice with different random seeds: a key that depends on
 * randomness, such as map iteration order, would not be one answer.
 */
async function runPredicts(
  result: CheckResult,
  runner: Pick<GoRunner, 'run'>,
  options: RunCheckOptions,
): Promise<Omit<RunCheckStats, 'examples' | 'passed'>> {
  const diag = result.diagnostics;
  const exercises = result.source.courses.flatMap((c) =>
    c.modules.flatMap((m) =>
      m.lessons.flatMap((l) => l.exercises.filter((x) => x.data.type === 'predict_output')),
    ),
  );
  const store: ExpectationStore = emptyStore();
  const outcomes = await Promise.all(
    exercises.map(async ({ file, data }) => {
      let spec: PredictOutputSpec;
      try {
        // `expected` is ours to compute; the content check reports an authored one.
        const { expected: _ignored, ...raw } = data.spec;
        spec = parseSpec('predict_output', raw) as PredictOutputSpec;
      } catch {
        return null; // The content check reports the spec errors.
      }
      const program = {
        files: [
          { name: 'main.go', content: spec.code.endsWith('\n') ? spec.code : `${spec.code}\n` },
        ],
        ...(spec.stdin === undefined ? {} : { stdin: spec.stdin }),
      };
      const first = observationOf(await runner.run({ ...program, randomSeed: SEED }));
      const second = observationOf(await runner.run({ ...program, randomSeed: SEED + 1 }));
      if (!sameObservation(first, second)) {
        return {
          file,
          error:
            '실행할 때마다 결과가 다릅니다(맵 순회 순서, 난수 등). 결과가 하나로 정해지는 코드를 쓰세요',
        };
      }
      const key = expectedFromObservation(spec, first);
      if (!key.ok) return { file, error: key.message };
      store.entries[data.id] = { inputHash: predictInputHash(data.spec), expected: key.expected };
      return { file, error: null };
    }),
  );
  for (const o of outcomes) if (o?.error) diag.error(o.file, `실행 검증: ${o.error}`);

  const name = join(options.root, EXPECTATIONS_FILE);
  let current = '';
  try {
    current = readFileSync(name, 'utf8');
  } catch {
    // No file yet.
  }
  const next = serializeExpectations(store);
  const empty = serializeExpectations(emptyStore());
  const expectationsChanged = current !== next && !(current === '' && next === empty);
  let wrote: string | null = null;
  if (expectationsChanged) {
    if (options.frozen) {
      diag.error(
        name,
        '실행 기대값 파일이 최신이 아닙니다. pnpm content:check:run을 실행하고 결과를 커밋하세요',
      );
    } else wrote = writeExpectations(options.root, store);
  }
  return {
    predicts: exercises.length,
    predictsPassed: outcomes.filter((o) => o !== null && o.error === null).length,
    expectationsChanged,
    wrote,
  };
}

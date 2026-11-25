import type { GoRunner } from '@proginone/go-runner';
import type { CheckResult } from './check.ts';

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
  return { examples: jobs.length, passed: outcomes.filter((p) => p.length === 0).length };
}

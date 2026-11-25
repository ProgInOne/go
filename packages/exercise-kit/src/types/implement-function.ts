import {
  buildResult,
  codeTextSchema,
  leakSet,
  localIdSchema,
  normalizeOutputLines,
  uniqueIds,
  type CheckResult,
  type ExerciseTypeDef,
  type FeedbackItem,
  type RunOutcome,
  type VerifyIssue,
} from '@proginone/exercise-core';
import { z } from 'zod';
import {
  MARKER_PLACEHOLDER,
  MAX_PLANNED_RUNS,
  type GoRanProgram,
  type GoRun,
  type GoRunPlan,
} from '../run-contract.ts';

// implement_function for Go (G-002, G-003). With `entry` the learner writes that function and
// `call` checks invoke it through a generated harness; without it the learner writes a whole
// program checked by its standard output (JS D-028). The server runs the plan and grades.

const VERSION = 1;

export const CODE_ANSWER_MAX_LENGTH = 64 * 1024;
export const LEARNER_FILE = 'main.go';
export const HARNESS_FILE = 'zz_harness.go';

const goIdentifierSchema = z.string().regex(/^[A-Za-z_][A-Za-z0-9_]{0,63}$/);
/** One Go expression on one line, e.g. `3`, `"go"`, `[]int{1, 2}`, `nil`. */
const goExpressionSchema = z
  .string()
  .min(1)
  .max(500)
  .regex(/^[^\n\r]*$/, 'one line');

const callCheckSchema = z.object({
  id: localIdSchema,
  kind: z.literal('call'),
  args: z.array(goExpressionSchema).max(8),
  /** One expected value per result, in order (an `error` result is often `nil`). */
  want: z.array(goExpressionSchema).min(1).max(4),
  description: z.string().max(300).optional(),
  hidden: z.boolean().default(false),
});

const stdoutCheckSchema = z.object({
  id: localIdSchema,
  kind: z.literal('stdout'),
  /** `exact`: the whole output, line by line (trailing spaces and blank lines ignored). */
  match: z.enum(['exact', 'contains']).default('exact'),
  text: z.string().max(10_000),
  stdin: z.string().max(10_000).optional(),
  description: z.string().max(300).optional(),
  hidden: z.boolean().default(false),
});

export const implementCheckSchema = z.discriminatedUnion('kind', [
  callCheckSchema,
  stdoutCheckSchema,
]);
export type ImplementCheck = z.infer<typeof implementCheckSchema>;

export const implementFunctionSpecSchema = z
  .object({
    /** What the editor starts with (`package main` and, for `entry`, the function's signature). */
    starter: codeTextSchema.min(1),
    /** Reference solution (answer key); content:check:run checks that it passes. */
    solution: codeTextSchema.min(1),
    /** The function `call` checks invoke. Without it the learner writes a program. */
    entry: goIdentifierSchema.optional(),
    checks: z.array(implementCheckSchema).min(1).max(30),
  })
  .superRefine((spec, ctx) => {
    uniqueIds(
      spec.checks.map((c) => c.id),
      ctx,
      ['checks'],
      'check',
    );
    const wanted = spec.entry === undefined ? 'stdout' : 'call';
    spec.checks.forEach((c, i) => {
      if (c.kind !== wanted) {
        ctx.addIssue({
          code: 'custom',
          message:
            wanted === 'call'
              ? 'with entry, checks are call checks'
              : 'without entry, checks are stdout checks',
          path: ['checks', i, 'kind'],
        });
      }
    });
    if (wanted === 'stdout') {
      const inputs = new Set(spec.checks.map((c) => (c.kind === 'stdout' ? (c.stdin ?? '') : '')));
      if (inputs.size > MAX_PLANNED_RUNS) {
        ctx.addIssue({
          code: 'custom',
          message: `at most ${String(MAX_PLANNED_RUNS)} different stdin values`,
          path: ['checks'],
        });
      }
    }
  });
export type ImplementFunctionSpec = z.infer<typeof implementFunctionSpecSchema>;

const publicCheckSchema = z.object({
  id: z.string(),
  kind: z.enum(['call', 'stdout']),
  description: z.string(),
  hidden: z.boolean(),
  /** Visible checks only. */
  args: z.array(z.string()).optional(),
  want: z.array(z.string()).optional(),
  stdin: z.string().optional(),
  text: z.string().optional(),
  match: z.enum(['exact', 'contains']).optional(),
});

export const implementFunctionPublicSpecSchema = z.object({
  starter: z.string(),
  entry: z.string().optional(),
  checks: z.array(publicCheckSchema),
});
export type ImplementFunctionPublicSpec = z.infer<typeof implementFunctionPublicSpecSchema>;

export const implementFunctionAnswerSchema = z.object({
  code: z.string().max(CODE_ANSWER_MAX_LENGTH),
});
export type ImplementFunctionAnswer = z.infer<typeof implementFunctionAnswerSchema>;

/** What the learner reads about a check. */
export function checkDescription(
  spec: Pick<ImplementFunctionSpec, 'entry'>,
  check: ImplementCheck,
  index: number,
): string {
  if (check.description) return check.description;
  if (check.hidden) return `숨겨진 사례 ${String(index + 1)}`;
  if (check.kind === 'call') {
    return `${spec.entry ?? '?'}(${check.args.join(', ')})의 결과가 ${check.want.join(', ')}`;
  }
  return check.match === 'contains' ? '출력에 기대한 내용이 있음' : '출력이 기대한 그대로';
}

const stdinsOf = (checks: readonly ImplementCheck[]) => [
  ...new Set(checks.map((c) => (c.kind === 'stdout' ? (c.stdin ?? '') : ''))),
];

/**
 * Standard packages a case's arguments or expected values may name (`errors.New("…")`,
 * `math.MaxInt`): the harness imports the ones the cases use.
 */
export const HARNESS_PACKAGES = [
  'errors',
  'math',
  'strings',
  'strconv',
  'time',
  'unicode',
] as const;

function harnessImports(checks: readonly ImplementCheck[]): string[] {
  const text = checks.flatMap((c) => (c.kind === 'call' ? [...c.args, ...c.want] : [])).join('\n');
  return HARNESS_PACKAGES.filter((pkg) => new RegExp(`(^|[^\\w.])${pkg}\\.`).test(text));
}

/**
 * The harness for `call` checks: a second file of package main whose `main` calls the entry for
 * each case inside a recover, converts the expected expression to the result's type
 * (`want := got; want = <expr>`), compares with reflect.DeepEqual and prints one JSON line per
 * case after the secret marker.
 */
export function buildHarness(entry: string, checks: readonly ImplementCheck[]): string {
  const used = harnessImports(checks);
  const cases = checks
    .filter((c) => c.kind === 'call')
    .map((c) => {
      const n = c.want.length;
      const got = Array.from({ length: n }, (_, i) => `got${String(i)}`);
      const lines = [
        `\tpioHarnessCase(${JSON.stringify(c.id)}, func() (string, string, bool) {`,
        `\t\t${got.join(', ')} := ${entry}(${c.args.join(', ')})`,
        ...c.want.flatMap((w, i) => [
          `\t\twant${String(i)} := got${String(i)}`,
          `\t\twant${String(i)} = ${w}`,
        ]),
        `\t\treturn pioHarnessShow(${got.join(', ')}), pioHarnessShow(${c.want.map((_, i) => `want${String(i)}`).join(', ')}), ${got
          .map((g, i) => `pioHarnessReflect.DeepEqual(${g}, want${String(i)})`)
          .join(' && ')}`,
        '\t})',
      ];
      return lines.join('\n');
    });
  return `package main

import (
	pioHarnessJSON "encoding/json"
	pioHarnessFmt "fmt"
	pioHarnessReflect "reflect"
	pioHarnessStrings "strings"${used.map((pkg) => `\n\t"${pkg}"`).join('')}
)

func main() {
${cases.join('\n')}
}

func pioHarnessShow(values ...any) string {
	parts := make([]string, len(values))
	for i, v := range values {
		parts[i] = pioHarnessFmt.Sprintf("%#v", v)
	}
	return pioHarnessStrings.Join(parts, ", ")
}

func pioHarnessCase(id string, f func() (string, string, bool)) {
	defer func() {
		if r := recover(); r != nil {
			pioHarnessEmit(id, "panic", pioHarnessFmt.Sprint(r), "", false)
		}
	}()
	got, want, ok := f()
	pioHarnessEmit(id, "ok", got, want, ok)
}

func pioHarnessEmit(id, status, got, want string, ok bool) {
	line, _ := pioHarnessJSON.Marshal(map[string]any{"id": id, "status": status, "got": got, "want": want, "ok": ok})
	pioHarnessFmt.Println("\\n${MARKER_PLACEHOLDER}" + string(line))
}
`;
}

const caseLineSchema = z.object({
  id: z.string(),
  status: z.enum(['ok', 'panic']),
  got: z.string(),
  want: z.string(),
  ok: z.boolean(),
});
type CaseLine = z.infer<typeof caseLineSchema>;

/** Result lines the harness printed after the marker; anything else on stdout is the learner's. */
function harnessLines(stdout: string, marker: string): Map<string, CaseLine> {
  const out = new Map<string, CaseLine>();
  for (const line of stdout.split('\n')) {
    const at = line.indexOf(marker);
    if (at < 0) continue;
    try {
      const parsed = caseLineSchema.safeParse(JSON.parse(line.slice(at + marker.length)));
      if (parsed.success && !out.has(parsed.data.id)) out.set(parsed.data.id, parsed.data);
    } catch {
      // Not a harness line.
    }
  }
  return out;
}

/** Why a program did not finish normally, for check results and feedback. */
const STOP_REASONS: Partial<Record<GoRanProgram['outcome'], { reason: string; message: string }>> =
  {
    'compile-error': { reason: 'COMPILE_ERROR', message: '컴파일 오류가 있어요.' },
    'compile-timeout': { reason: 'COMPILE_TIMEOUT', message: '컴파일이 너무 오래 걸렸어요.' },
    'compile-output-limit': {
      reason: 'COMPILE_ERROR',
      message: '컴파일 오류 메시지가 너무 길어요.',
    },
    panic: { reason: 'PANIC', message: '실행 중 panic이 났어요.' },
    fatal: { reason: 'FATAL', message: 'Go 런타임이 프로그램을 멈췄어요.' },
    memory: { reason: 'MEMORY', message: '메모리를 너무 많이 썼어요.' },
    timeout: {
      reason: 'TIMEOUT',
      message: '5초 안에 끝나지 않았어요. 끝나지 않는 반복문이 있는지 확인해 보세요.',
    },
    'output-limit': { reason: 'OUTPUT_LIMIT', message: '출력이 너무 많아요.' },
    crash: { reason: 'CRASH', message: '실행 환경에 문제가 생겼어요. 다시 제출해 주세요.' },
  };

/**
 * Compiler text for the learner: their file's lines as written; errors inside the harness say
 * only that the function does not match (they could show hidden cases' arguments).
 */
export function learnerCompileText(output: string, entry: string | undefined): string {
  if (output.includes('main redeclared') && entry !== undefined) {
    return `이 문제는 main 함수 없이 ${entry} 함수만 작성해요.`;
  }
  const lines = output.split('\n').filter((l) => l.trim() !== '');
  const mine = lines.filter((l) => !l.includes(HARNESS_FILE));
  const harness = lines.length - mine.length;
  const notes = [...mine];
  if (harness > 0 && entry !== undefined) {
    notes.push(
      `${entry} 함수의 이름, 매개변수, 반환값이 문제에서 말한 모양과 같은지 확인해 보세요.`,
    );
  }
  return notes.join('\n');
}

function gradeRun(spec: ImplementFunctionSpec, run: GoRun) {
  const checkResults: CheckResult[] = [];
  const feedback: FeedbackItem[] = [];
  // An object, so the closures below can raise it (a `let` would stay narrowed to 'ok').
  const state: { outcome: RunOutcome } = { outcome: 'ok' };
  const stops = new Set<string>();

  const stopOf = (ran: GoRanProgram | undefined) => {
    if (!ran) return STOP_REASONS.crash;
    if (ran.outcome === 'exit')
      return ran.exitCode === 0
        ? undefined
        : {
            reason: 'EXIT_CODE',
            message: `프로그램이 종료 코드 ${String(ran.exitCode)}로 끝났어요.`,
          };
    return STOP_REASONS[ran.outcome];
  };
  const noteStop = (ran: GoRanProgram | undefined) => {
    if (!ran) {
      state.outcome = 'sandbox_failure';
      return;
    }
    if (ran.outcome === 'crash') state.outcome = 'sandbox_failure';
    else if (state.outcome === 'ok' && ran.outcome !== 'exit') state.outcome = 'learner_failure';
    const key = `${ran.id}:${ran.outcome}`;
    if (stops.has(key)) return;
    stops.add(key);
    if (ran.outcome === 'compile-error') {
      feedback.push({
        level: 'error',
        code: 'COMPILE_ERROR',
        message: `컴파일 오류가 있어요.\n${learnerCompileText(ran.compileOutput ?? '', spec.entry)}`,
      });
    } else {
      const stop = stopOf(ran);
      if (stop) {
        const first = ran.stderr.split('\n').find((l) => l.trim() !== '');
        feedback.push({
          level: 'error',
          code: stop.reason,
          message: first ? `${stop.message} ${first}` : stop.message,
        });
      }
    }
  };

  if (spec.entry !== undefined) {
    const ran = run.runs.find((r) => r.id === 'calls');
    const lines = ran ? harnessLines(ran.stdout, run.marker) : new Map<string, CaseLine>();
    spec.checks.forEach((check, i) => {
      const line = lines.get(check.id);
      const base = {
        id: check.id,
        kind: check.kind,
        required: true,
        weight: 1,
        visible: !check.hidden,
        description: checkDescription(spec, check, i),
      };
      if (line?.status === 'ok') {
        checkResults.push({
          ...base,
          passed: line.ok,
          ...(line.ok ? {} : { reason: 'MISMATCH' }),
          ...(!line.ok && !check.hidden
            ? { detail: { expected: line.want, actual: line.got } }
            : {}),
        });
      } else if (line?.status === 'panic') {
        checkResults.push({
          ...base,
          passed: false,
          reason: 'PANIC',
          ...(check.hidden ? {} : { detail: { actual: `panic: ${line.got}` } }),
        });
      } else {
        checkResults.push({ ...base, passed: false, reason: stopOf(ran)?.reason ?? 'NO_RESULT' });
      }
    });
    if (ran?.outcome !== 'exit' || lines.size < spec.checks.length) noteStop(ran);
  } else {
    const stdins = stdinsOf(spec.checks);
    spec.checks.forEach((check, i) => {
      if (check.kind !== 'stdout') return;
      const ran = run.runs.find(
        (r) => r.id === `stdin-${String(stdins.indexOf(check.stdin ?? ''))}`,
      );
      const base = {
        id: check.id,
        kind: check.kind,
        required: true,
        weight: 1,
        visible: !check.hidden,
        description: checkDescription(spec, check, i),
      };
      const stop = stopOf(ran);
      if (!ran || stop) {
        noteStop(ran);
        checkResults.push({ ...base, passed: false, reason: stop?.reason ?? 'NO_RESULT' });
        return;
      }
      const actual = normalizeOutputLines(ran.stdout);
      const expected = normalizeOutputLines(check.text);
      const passed =
        check.match === 'contains'
          ? normalizeOutputLines(ran.stdout).join('\n').includes(expected.join('\n'))
          : actual.length === expected.length && actual.every((l, j) => l === expected[j]);
      checkResults.push({
        ...base,
        passed,
        ...(passed ? {} : { reason: 'MISMATCH' }),
        ...(!passed && !check.hidden
          ? { detail: { expected: expected.join('\n'), actual: actual.join('\n') } }
          : {}),
      });
    });
  }
  return { checkResults, feedback, outcome: state.outcome };
}

export const implementFunction: ExerciseTypeDef<
  ImplementFunctionSpec,
  ImplementFunctionPublicSpec,
  ImplementFunctionAnswer,
  GoRun,
  GoRunPlan
> = {
  id: 'implement_function',
  version: VERSION,
  category: 'production',
  specSchema: implementFunctionSpecSchema,
  publicSpecSchema: implementFunctionPublicSpecSchema,
  answerSchema: implementFunctionAnswerSchema,
  requiresRun: () => true,
  writing: () => true,

  redact(spec) {
    const out: ImplementFunctionPublicSpec = {
      starter: spec.starter,
      checks: spec.checks.map((c, i) => {
        const description = checkDescription(spec, c, i);
        if (c.hidden) return { id: c.id, kind: c.kind, description, hidden: true };
        return c.kind === 'call'
          ? { id: c.id, kind: c.kind, description, hidden: false, args: c.args, want: c.want }
          : {
              id: c.id,
              kind: c.kind,
              description,
              hidden: false,
              text: c.text,
              match: c.match,
              ...(c.stdin === undefined ? {} : { stdin: c.stdin }),
            };
      }),
    };
    if (spec.entry !== undefined) out.entry = spec.entry;
    return out;
  },

  buildRunPlan(spec, answer, options) {
    const learner = { name: LEARNER_FILE, content: answer.code };
    const checks =
      options.purpose === 'interactive' ? spec.checks.filter((c) => !c.hidden) : spec.checks;
    if (spec.entry !== undefined) {
      return {
        runs: [
          {
            id: 'calls',
            files: [learner, { name: HARNESS_FILE, content: buildHarness(spec.entry, checks) }],
          },
        ],
      };
    }
    return {
      runs: stdinsOf(spec.checks).map((stdin, i) => ({
        id: `stdin-${String(i)}`,
        files: [learner],
        ...(stdin === '' ? {} : { stdin }),
      })),
    };
  },

  grade({ spec, run }) {
    if (!run) {
      return buildResult({
        typeId: 'implement_function',
        version: VERSION,
        correct: false,
        score: 0,
        run: 'sandbox_failure',
        feedback: [
          {
            level: 'error',
            code: 'RUN_MISSING',
            message: '코드를 실행하지 못했어요. 다시 제출해 주세요.',
          },
        ],
      });
    }
    const { checkResults, feedback, outcome } = gradeRun(spec, run);
    const passed = checkResults.filter((c) => c.passed).length;
    const correct = passed === checkResults.length && outcome === 'ok';
    if (correct) {
      feedback.unshift({
        level: 'success',
        code: 'ALL_CHECKS_PASSED',
        message: '모든 사례를 통과했어요.',
      });
    }
    return buildResult({
      typeId: 'implement_function',
      version: VERSION,
      correct,
      score: checkResults.length === 0 ? 0 : passed / checkResults.length,
      feedback,
      checkResults,
      run: outcome,
    });
  },

  verify(spec) {
    const issues: VerifyIssue[] = [];
    for (const [name, code] of [
      ['starter', spec.starter],
      ['solution', spec.solution],
    ] as const) {
      if (!/^package main\b/m.test(code)) {
        issues.push({
          severity: 'error',
          code: 'NOT_MAIN_PACKAGE',
          message: `${name}은 package main이어야 합니다`,
          path: name,
        });
      }
      if (spec.entry !== undefined && !new RegExp(`\\bfunc ${spec.entry}\\(`).test(code)) {
        issues.push({
          severity: 'error',
          code: 'ENTRY_MISSING',
          message: `${name}에 func ${spec.entry}(가 없습니다`,
          path: name,
        });
      }
      if (spec.entry !== undefined && /\bfunc main\(/.test(code)) {
        issues.push({
          severity: 'error',
          code: 'MAIN_WITH_ENTRY',
          message: `entry가 있는 문제의 ${name}에는 main 함수를 두지 않습니다`,
          path: name,
        });
      }
    }
    if (spec.checks.every((c) => c.hidden)) {
      issues.push({
        severity: 'warning',
        code: 'ALL_HIDDEN',
        message: '보이는 사례가 하나도 없습니다',
        path: 'checks',
      });
    }
    return issues;
  },

  leakFingerprints(spec) {
    const starter = new Set(spec.starter.split('\n').map((l) => l.trim()));
    return leakSet(
      spec.solution
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.length >= 8 && !starter.has(l)),
    );
  },
};

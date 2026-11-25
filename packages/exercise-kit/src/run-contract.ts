import { z } from 'zod';

// The Go runner contract (G-002, G-003): what a code-running exercise type asks the server to
// run (plan), and what comes back (run). The server and content-cli execute a plan with the
// learner's Go through `executeRunPlan`; this package stays pure (no I/O), so the runner is
// passed in.

/** Placeholder in harness code for the per-run secret marker (see {@link executeRunPlan}). */
export const MARKER_PLACEHOLDER = '__PROGINONE_MARKER__';

export interface GoSourceFile {
  name: string;
  content: string;
}

/** One program to compile and run. */
export interface GoPlannedRun {
  id: string;
  files: GoSourceFile[];
  stdin?: string;
}

export interface GoRunPlan {
  runs: GoPlannedRun[];
}

/** Maximum programs one plan may run (program checks with different standard input). */
export const MAX_PLANNED_RUNS = 10;

export const GO_RUN_OUTCOMES = [
  'exit',
  'panic',
  'fatal',
  'memory',
  'timeout',
  'output-limit',
  'crash',
  'compile-error',
  'compile-timeout',
  'compile-output-limit',
] as const;
export type GoRunOutcome = (typeof GO_RUN_OUTCOMES)[number];

const ranSchema = z.object({
  id: z.string().max(64),
  outcome: z.enum(GO_RUN_OUTCOMES),
  exitCode: z.int().nullable(),
  stdout: z.string().max(256 * 1024),
  stderr: z.string().max(256 * 1024),
  /** Compiler text for `compile-error`. */
  compileOutput: z
    .string()
    .max(256 * 1024)
    .optional(),
});
export type GoRanProgram = z.infer<typeof ranSchema>;

export const goRunSchema = z.object({
  /** The secret the harness printed its result lines with. */
  marker: z.string().min(16).max(128),
  runs: z.array(ranSchema).max(MAX_PLANNED_RUNS),
});
export type GoRun = z.infer<typeof goRunSchema>;

/** The registry's `parseRun`: validates a run result before a grader sees it. */
export function parseGoRun(
  raw: unknown,
): { success: true; data: GoRun } | { success: false; error: string } {
  const parsed = goRunSchema.safeParse(raw);
  return parsed.success
    ? { success: true, data: parsed.data }
    : { success: false, error: parsed.error.issues.map((i) => i.message).join('; ') };
}

/**
 * What a runner returns, structurally (the `@proginone/go-runner` result, without depending on
 * it). Only the fields grading needs.
 */
export type RunnerResult =
  | {
      phase: 'compile';
      compile: { reason: 'compile-error'; output: string } | { reason: string };
    }
  | {
      phase: 'run';
      run: { reason: string; exitCode: number | null; stdout: string; stderr: string };
    };

export type RunProgram = (input: {
  files: GoSourceFile[];
  stdin?: string;
  randomSeed: number;
}) => Promise<RunnerResult>;

/** Random seed for graded and verification runs: the same code prints the same thing. */
export const GRADING_SEED = 1;

function toRan(id: string, result: RunnerResult): GoRanProgram {
  if (result.phase === 'compile') {
    const c = result.compile;
    if (c.reason === 'compile-error' && 'output' in c) {
      return {
        id,
        outcome: 'compile-error',
        exitCode: null,
        stdout: '',
        stderr: '',
        compileOutput: c.output,
      };
    }
    const outcome: GoRunOutcome =
      c.reason === 'timeout'
        ? 'compile-timeout'
        : c.reason === 'output-limit'
          ? 'compile-output-limit'
          : 'crash';
    return { id, outcome, exitCode: null, stdout: '', stderr: '' };
  }
  const r = result.run;
  const outcome = (GO_RUN_OUTCOMES as readonly string[]).includes(r.reason)
    ? (r.reason as GoRunOutcome)
    : 'crash';
  return { id, outcome, exitCode: r.exitCode, stdout: r.stdout, stderr: r.stderr };
}

/**
 * Runs every program of a plan, one after another, with `marker` in place of the harness
 * placeholder. The caller makes the marker (random per submission) so a learner's program cannot
 * print a fake result line.
 */
export async function executeRunPlan(
  plan: GoRunPlan,
  marker: string,
  run: RunProgram,
): Promise<GoRun> {
  const runs: GoRanProgram[] = [];
  for (const planned of plan.runs.slice(0, MAX_PLANNED_RUNS)) {
    const files = planned.files.map((f) => ({
      name: f.name,
      content: f.content.replaceAll(MARKER_PLACEHOLDER, marker),
    }));
    const result = await run({
      files,
      ...(planned.stdin === undefined ? {} : { stdin: planned.stdin }),
      randomSeed: GRADING_SEED,
    });
    runs.push(toRan(planned.id, result));
  }
  return { marker, runs };
}

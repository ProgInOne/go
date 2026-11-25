import {
  buildResult,
  codeTextSchema,
  ExerciseKitError,
  leakSet,
  localIdSchema,
  misconceptionIdSchema,
  normalizeOutputLines,
  uniqueIds,
  type ExerciseTypeDef,
  type FeedbackItem,
  type VerifyIssue,
} from '@proginone/exercise-core';
import { z } from 'zod';

// predict_output for Go (G-002, G-003): the learner predicts what a whole program prints, or
// picks the outcome among choices. The answer key comes from a real run at build time
// (`content:check:run` → content/.generated/predict-expected.json), so grading needs no run.

const VERSION = 1;

export const PREDICT_ANSWER_MAX_LENGTH = 10_000;

/** What a choice stands for when it is not printed text. */
export const PREDICT_OUTCOMES = ['compile-error', 'panic'] as const;
export type PredictOutcome = (typeof PREDICT_OUTCOMES)[number];

/** Execution-derived answer key, filled in by check/build, never by authors. */
export const predictExpectedSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('output'), lines: z.array(z.string().max(10_000)).max(1_000) }),
  z.object({ kind: z.literal('choice'), choiceId: localIdSchema }),
]);
export type PredictExpected = z.infer<typeof predictExpectedSchema>;

const choiceSchema = z.object({
  id: localIdSchema,
  /** Shown to the learner; for a text choice, also the output it stands for. */
  text: z.string().min(1).max(4_000),
  /** The choice means "it does not compile" / "it panics" instead of printed text. */
  outcome: z.enum(PREDICT_OUTCOMES).optional(),
});

export const predictOutputSpecSchema = z
  .object({
    /** A whole `package main` program, gofmt-formatted (content:check:run checks it). */
    code: codeTextSchema.min(1),
    /** Standard input the program reads. */
    stdin: z.string().max(10_000).optional(),
    /** `output`: type what it prints. `choice`: pick the outcome. */
    answerKind: z.enum(['output', 'choice']),
    choices: z.array(choiceSchema).min(2).max(6).optional(),
    expected: predictExpectedSchema.nullish(),
    /** A specific wrong answer (output text, or choice ID) → misconception (answer key). */
    misconceptionByAnswer: z.record(z.string().max(2_000), misconceptionIdSchema).optional(),
  })
  .superRefine((spec, ctx) => {
    if (spec.answerKind === 'choice') {
      if (!spec.choices) {
        ctx.addIssue({
          code: 'custom',
          message: 'answerKind choice needs choices',
          path: ['choices'],
        });
      } else {
        uniqueIds(
          spec.choices.map((c) => c.id),
          ctx,
          ['choices'],
          'choice',
        );
      }
    } else if (spec.choices) {
      ctx.addIssue({
        code: 'custom',
        message: 'choices are for answerKind choice',
        path: ['choices'],
      });
    }
    const expected = spec.expected;
    if (expected) {
      const kind = spec.answerKind === 'output' ? 'output' : 'choice';
      if (expected.kind !== kind) {
        ctx.addIssue({
          code: 'custom',
          message: 'expected.kind must match answerKind',
          path: ['expected'],
        });
      } else if (
        expected.kind === 'choice' &&
        !spec.choices?.some((c) => c.id === expected.choiceId)
      ) {
        ctx.addIssue({
          code: 'custom',
          message: 'expected.choiceId must be a choice id',
          path: ['expected'],
        });
      }
    }
  });
export type PredictOutputSpec = z.infer<typeof predictOutputSpecSchema>;

export const predictOutputPublicSpecSchema = z.object({
  code: z.string(),
  stdin: z.string().optional(),
  answerKind: z.enum(['output', 'choice']),
  choices: z.array(z.object({ id: localIdSchema, text: z.string() })).optional(),
});
export type PredictOutputPublicSpec = z.infer<typeof predictOutputPublicSpecSchema>;

export const predictOutputAnswerSchema = z.union([
  z.object({ output: z.string().max(PREDICT_ANSWER_MAX_LENGTH) }),
  z.object({ choiceId: z.string().max(64) }),
]);
export type PredictOutputAnswer = z.infer<typeof predictOutputAnswerSchema>;

/** How the program ended in the content check's run (go-runner result, reduced). */
export type PredictObservation =
  | { kind: 'output'; stdout: string }
  | { kind: 'compile-error' }
  | { kind: 'panic' }
  /** Anything else (non-zero exit, timeout, fatal error, …): not a valid exercise. */
  | { kind: 'other'; reason: string };

const sameLines = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((line, i) => line === b[i]);

/**
 * The answer key for a spec from how its program ran. Fails (with a Korean message for the
 * author) when the run cannot be an answer: an output question whose program does not print
 * normally, or choices of which not exactly one matches.
 */
export function expectedFromObservation(
  spec: PredictOutputSpec,
  observation: PredictObservation,
): { ok: true; expected: PredictExpected } | { ok: false; message: string } {
  if (observation.kind === 'other') {
    return { ok: false, message: `프로그램이 정상으로 끝나지 않습니다(${observation.reason})` };
  }
  if (spec.answerKind === 'output') {
    if (observation.kind !== 'output') {
      return {
        ok: false,
        message: `출력 예측 문제인데 ${observation.kind === 'panic' ? 'panic이 납니다' : '컴파일 오류가 납니다'}. answerKind choice로 결과를 묻거나 코드를 고치세요`,
      };
    }
    return {
      ok: true,
      expected: { kind: 'output', lines: normalizeOutputLines(observation.stdout) },
    };
  }
  const choices = spec.choices ?? [];
  const matching = choices.filter((c) =>
    observation.kind === 'output'
      ? c.outcome === undefined &&
        sameLines(normalizeOutputLines(c.text), normalizeOutputLines(observation.stdout))
      : c.outcome === observation.kind,
  );
  const actual =
    observation.kind === 'output'
      ? `출력 ${JSON.stringify(observation.stdout)}`
      : observation.kind === 'panic'
        ? 'panic'
        : '컴파일 오류';
  if (matching.length !== 1) {
    return {
      ok: false,
      message:
        matching.length === 0
          ? `실제 결과(${actual})와 같은 보기가 없습니다`
          : `실제 결과(${actual})와 같은 보기가 ${String(matching.length)}개입니다`,
    };
  }
  const [only] = matching;
  return only
    ? { ok: true, expected: { kind: 'choice', choiceId: only.id } }
    : { ok: false, message: '보기를 찾지 못했습니다' };
}

function gradeOutput(
  spec: PredictOutputSpec,
  expected: readonly string[],
  text: string,
): { correct: boolean; score: number; feedback: FeedbackItem[]; misconceptions: string[] } {
  const actual = normalizeOutputLines(text);
  const feedback: FeedbackItem[] = [];
  const total = Math.max(expected.length, actual.length);
  let matched = 0;
  for (let i = 0; i < total; i++) {
    if (expected[i] === actual[i]) matched += 1;
    else if (i < actual.length && i < expected.length) {
      feedback.push({
        level: 'error',
        code: 'PREDICT_LINE_WRONG',
        message: `${String(i + 1)}번째 줄이 실제 출력과 달라요.`,
        target: String(i + 1),
      });
    }
  }
  if (expected.length !== actual.length) {
    feedback.push({
      level: 'error',
      code: 'PREDICT_LINE_COUNT',
      message:
        actual.length < expected.length ? '출력 줄이 더 있어요.' : '실제 출력보다 줄이 많아요.',
    });
  }
  const correct = sameLines(expected, actual);
  const misconceptions = correct
    ? []
    : Object.entries(spec.misconceptionByAnswer ?? {})
        .filter(([key]) => sameLines(normalizeOutputLines(key), actual))
        .map(([, id]) => id);
  return { correct, score: total === 0 ? 1 : matched / total, feedback, misconceptions };
}

export const predictOutput: ExerciseTypeDef<
  PredictOutputSpec,
  PredictOutputPublicSpec,
  PredictOutputAnswer
> = {
  id: 'predict_output',
  version: VERSION,
  category: 'recall',
  specSchema: predictOutputSpecSchema,
  publicSpecSchema: predictOutputPublicSpecSchema,
  answerSchema: predictOutputAnswerSchema,
  requiresRun: () => false,

  redact(spec) {
    const out: PredictOutputPublicSpec = { code: spec.code, answerKind: spec.answerKind };
    if (spec.stdin !== undefined) out.stdin = spec.stdin;
    if (spec.choices) out.choices = spec.choices.map(({ id, text }) => ({ id, text }));
    return out;
  },

  grade({ spec, answer }) {
    const expected = spec.expected;
    if (!expected) {
      throw new ExerciseKitError(
        'EXPECTED_MISSING',
        'predict_output spec has no execution-derived expected value',
      );
    }
    let result: {
      correct: boolean;
      score: number;
      feedback: FeedbackItem[];
      misconceptions: string[];
    };
    if (expected.kind === 'output' && 'output' in answer) {
      result = gradeOutput(spec, expected.lines, answer.output);
    } else if (expected.kind === 'choice' && 'choiceId' in answer) {
      const correct = expected.choiceId === answer.choiceId;
      result = {
        correct,
        score: correct ? 1 : 0,
        feedback: [],
        misconceptions: correct
          ? []
          : Object.entries(spec.misconceptionByAnswer ?? {})
              .filter(([key]) => key === answer.choiceId)
              .map(([, id]) => id),
      };
    } else {
      throw new ExerciseKitError(
        'INVALID_ANSWER',
        `answer does not match answerKind ${spec.answerKind}`,
      );
    }
    if (result.correct) {
      result.feedback.unshift({
        level: 'success',
        code: 'PREDICT_CORRECT',
        message: '예측이 맞았어요.',
      });
    }
    return buildResult({
      typeId: 'predict_output',
      version: VERSION,
      correct: result.correct,
      score: result.score,
      feedback: result.feedback,
      misconceptionIds: result.misconceptions,
    });
  },

  verify(spec) {
    const issues: VerifyIssue[] = [];
    if (!spec.expected) {
      issues.push({
        severity: 'warning',
        code: 'EXPECTED_MISSING',
        message: '실행 기대값이 없습니다. pnpm content:check:run으로 계산하세요',
        path: 'expected',
      });
    }
    if (spec.answerKind === 'choice' && spec.misconceptionByAnswer) {
      for (const key of Object.keys(spec.misconceptionByAnswer)) {
        if (!spec.choices?.some((c) => c.id === key)) {
          issues.push({
            severity: 'error',
            code: 'MISCONCEPTION_KEY_UNKNOWN',
            message: `misconceptionByAnswer의 ${key}는 보기 ID가 아닙니다`,
            path: 'misconceptionByAnswer',
          });
        }
      }
    }
    if (spec.expected?.kind === 'choice' && spec.misconceptionByAnswer?.[spec.expected.choiceId]) {
      issues.push({
        severity: 'error',
        code: 'PREDICT_MISCONCEPTION_EQUALS_ANSWER',
        message: '정답 보기에 오개념을 연결했습니다',
        path: 'misconceptionByAnswer',
      });
    }
    return issues;
  },

  leakFingerprints(spec) {
    const expected = spec.expected;
    if (!expected) return [];
    if (expected.kind === 'output') return leakSet([expected.lines.join('\n'), ...expected.lines]);
    return leakSet([spec.choices?.find((c) => c.id === expected.choiceId)?.text]);
  },
};

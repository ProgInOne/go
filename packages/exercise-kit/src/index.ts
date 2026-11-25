import {
  COMMON_EXERCISE_TYPE_IDS,
  COMMON_EXERCISE_TYPES,
  createExerciseRegistry,
  registerExerciseType,
} from '@proginone/exercise-core';
import { parseGoRun, type GoRun, type GoRunPlan } from './run-contract.ts';
import { implementFunction } from './types/implement-function.ts';
import { predictOutput } from './types/predict-output.ts';

/** Exercise types of this repository, in registration order. */
export const EXERCISE_TYPE_IDS = [
  ...COMMON_EXERCISE_TYPE_IDS,
  'predict_output',
  'implement_function',
] as const;

/**
 * This repository's exercise registry (JS D-096): the common choice types and the Go types
 * (G-002, G-003). `predict_output` is graded against a build-time run; `implement_function` is
 * graded against a run the server makes from the type's plan (`buildRunPlan` → `executeRunPlan`).
 * Run results are validated with the Go runner contract (`parseGoRun`).
 */
export const registry = createExerciseRegistry<GoRun, GoRunPlan>({
  types: [
    ...COMMON_EXERCISE_TYPES,
    registerExerciseType(predictOutput),
    registerExerciseType(implementFunction),
  ],
  parseRun: parseGoRun,
});

/**
 * Boundary functions: each validates untrusted input (content source, AI output, learner answers)
 * with the type's schemas, then calls the pure implementation.
 */
export const {
  buildRunPlan,
  checkSpec,
  getExerciseType,
  gradeSubmission,
  implementedExerciseTypes,
  isWritingExercise,
  leakFingerprints,
  parseAnswer,
  parseSpec,
  redactSpec,
  specMisconceptions,
  verifySpec,
} = registry;

export {
  executeRunPlan,
  GO_RUN_OUTCOMES,
  GRADING_SEED,
  goRunSchema,
  MARKER_PLACEHOLDER,
  MAX_PLANNED_RUNS,
  parseGoRun,
  type GoPlannedRun,
  type GoRanProgram,
  type GoRun,
  type GoRunOutcome,
  type GoRunPlan,
  type GoSourceFile,
  type RunnerResult,
  type RunProgram,
} from './run-contract.ts';
export {
  buildHarness,
  checkDescription,
  CODE_ANSWER_MAX_LENGTH,
  HARNESS_FILE,
  implementFunctionAnswerSchema,
  implementFunctionPublicSpecSchema,
  LEARNER_FILE,
  learnerCompileText,
  type ImplementCheck,
  type ImplementFunctionAnswer,
  type ImplementFunctionPublicSpec,
  type ImplementFunctionSpec,
} from './types/implement-function.ts';
export {
  expectedFromObservation,
  PREDICT_ANSWER_MAX_LENGTH,
  PREDICT_OUTCOMES,
  predictExpectedSchema,
  predictOutputAnswerSchema,
  predictOutputPublicSpecSchema,
  type PredictExpected,
  type PredictObservation,
  type PredictOutcome,
  type PredictOutputAnswer,
  type PredictOutputPublicSpec,
  type PredictOutputSpec,
} from './types/predict-output.ts';

export {
  EXERCISE_KIT_ERROR_CODES,
  ExerciseKitError,
  type ExerciseKitErrorCode,
  type GradeResult,
  type RegisteredExerciseType,
  // Language-neutral helpers the server uses, re-exported so the apps keep one import.
  exerciseOriginOf,
  variantGroupKey,
  type ExerciseOrigin,
  hasProtoKey,
  withinDepth,
  normalizeLeakText,
  type McqMultiSpec,
  type McqSingleSpec,
  type TrueFalseSpec,
} from '@proginone/exercise-core';

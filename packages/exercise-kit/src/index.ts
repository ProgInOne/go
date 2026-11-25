import {
  COMMON_EXERCISE_TYPE_IDS,
  COMMON_EXERCISE_TYPES,
  createExerciseRegistry,
  registerExerciseType,
} from '@proginone/exercise-core';
import { predictOutput } from './types/predict-output.ts';

/** Exercise types of this repository, in registration order. */
export const EXERCISE_TYPE_IDS = [...COMMON_EXERCISE_TYPE_IDS, 'predict_output'] as const;

/**
 * This repository's exercise registry (JS D-096): the common choice types and the Go types
 * (G-002). `predict_output` is graded against a build-time run, so no type needs a run result
 * yet and there is no runner contract: a submission that carries one is rejected.
 */
export const registry = createExerciseRegistry({
  types: [...COMMON_EXERCISE_TYPES, registerExerciseType(predictOutput)],
});

/**
 * Boundary functions: each validates untrusted input (content source, AI output, learner answers)
 * with the type's schemas, then calls the pure implementation.
 */
export const {
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

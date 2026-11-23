import { COMMON_EXERCISE_TYPES, createExerciseRegistry } from '@proginone/exercise-core';

/**
 * This repository's exercise registry (JS D-096). The skeleton has no Go execution (G-001), so it
 * holds only the common choice types and no runner contract: a submission that carries a run
 * result is rejected. Go types and their runner contract come with the Go-specific design.
 */
export const registry = createExerciseRegistry({ types: COMMON_EXERCISE_TYPES });

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
  COMMON_EXERCISE_TYPE_IDS as EXERCISE_TYPE_IDS,
  EXERCISE_KIT_ERROR_CODES,
  ExerciseKitError,
  type ExerciseKitErrorCode,
  type GradeResult,
  type RegisteredExerciseType,
} from '@proginone/exercise-core';

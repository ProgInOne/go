// The exercise model and renderer of this repository's exercise types. Go has only the common
// choice types for now (G-001), so everything maps onto @proginone/exercise-ui's choice model.
// Code-running types and their renderers come with the Go-specific design.
import {
  ChoiceRenderer,
  choiceInitialAnswer,
  choiceNotReadyReason,
  isChoiceAnswerReady,
  parseChoicePublicSpec,
  type ChoiceAnswerByType,
  type ChoiceExercise,
  type ChoiceTypeId,
} from '@proginone/exercise-ui';

export type RenderableTypeId = ChoiceTypeId;
export type RenderableExercise = ChoiceExercise;
export type AnswerByType = ChoiceAnswerByType;

/** Validates a public spec from the server; null for a type this app cannot render. */
export const parsePublicSpec = parseChoicePublicSpec;
/** The empty answer an exercise starts from. */
export const initialAnswer = choiceInitialAnswer;
/** Whether the answer can be submitted. */
export const isAnswerReady = isChoiceAnswerReady;
/** Why the answer cannot be submitted yet. */
export const notReadyReason = choiceNotReadyReason;

export interface ExerciseRendererProps {
  exercise: RenderableExercise;
  /** Answer for `exercise.typeId` (start from `initialAnswer(exercise)`). */
  value: AnswerByType[RenderableTypeId];
  onChange: (answer: NonNullable<AnswerByType[RenderableTypeId]>) => void;
  disabled?: boolean;
  labelledBy?: string;
  /** mcq_single: correct option revealed after grading. */
  correctOptionId?: string | null;
}

/** Picks the renderer for `exercise.typeId`. */
export function ExerciseRenderer(props: ExerciseRendererProps) {
  return <ChoiceRenderer {...props} />;
}

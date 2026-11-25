// The exercise model and renderer of this repository's exercise types: the common choice types
// (@proginone/exercise-ui's choice model) and the Go types (G-002).
import {
  predictOutputPublicSpecSchema,
  type PredictOutputPublicSpec,
} from '@proginone/exercise-kit';
import {
  ChoiceRenderer,
  choiceInitialAnswer,
  choiceNotReadyReason,
  isChoiceAnswerReady,
  isChoiceType,
  parseChoicePublicSpec,
  type ChoiceAnswerByType,
  type ChoiceExercise,
  type ChoiceTypeId,
} from '@proginone/exercise-ui';
import { PredictOutput, type PredictOutputDraft } from './PredictOutput.tsx';

export type RenderableTypeId = ChoiceTypeId | 'predict_output';
export interface PredictExercise {
  typeId: 'predict_output';
  spec: PredictOutputPublicSpec;
}
export type RenderableExercise = ChoiceExercise | PredictExercise;
export interface AnswerByType extends ChoiceAnswerByType {
  predict_output: PredictOutputDraft;
}

/** Validates a public spec from the server; null for a type this app cannot render. */
export function parsePublicSpec(typeId: string, raw: unknown): RenderableExercise | null {
  if (isChoiceType(typeId)) return parseChoicePublicSpec(typeId, raw);
  if (typeId === 'predict_output') {
    const parsed = predictOutputPublicSpecSchema.safeParse(raw);
    return parsed.success ? { typeId, spec: parsed.data } : null;
  }
  return null;
}

/** The empty answer an exercise starts from. */
export function initialAnswer(exercise: RenderableExercise): AnswerByType[RenderableTypeId] {
  if (exercise.typeId === 'predict_output') {
    return exercise.spec.answerKind === 'output' ? { output: '' } : null;
  }
  return choiceInitialAnswer(exercise);
}

/** Whether the answer can be submitted. */
export function isAnswerReady(
  exercise: RenderableExercise,
  answer: AnswerByType[RenderableTypeId],
): boolean {
  if (exercise.typeId === 'predict_output') {
    if (answer === null || typeof answer !== 'object') return false;
    if ('output' in answer) return typeof answer.output === 'string' && answer.output.trim() !== '';
    return 'choiceId' in answer;
  }
  return isChoiceAnswerReady(exercise, answer as ChoiceAnswerByType[ChoiceTypeId]);
}

/** Why the answer cannot be submitted yet. */
export function notReadyReason(exercise: RenderableExercise): string {
  if (exercise.typeId === 'predict_output') {
    return exercise.spec.answerKind === 'output'
      ? '예상한 출력을 적어 주세요'
      : '보기를 골라 주세요';
  }
  return choiceNotReadyReason(exercise);
}

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
export function ExerciseRenderer({ exercise, value, onChange, ...rest }: ExerciseRendererProps) {
  if (exercise.typeId === 'predict_output') {
    const { correctOptionId: _ignored, ...common } = rest;
    return (
      <PredictOutput
        spec={exercise.spec}
        value={value as PredictOutputDraft}
        onChange={onChange}
        {...common}
      />
    );
  }
  return (
    <ChoiceRenderer
      exercise={exercise}
      value={value as ChoiceAnswerByType[ChoiceTypeId]}
      onChange={onChange}
      {...rest}
    />
  );
}

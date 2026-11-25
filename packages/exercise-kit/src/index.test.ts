import { describe, expect, it } from 'vitest';
import {
  EXERCISE_TYPE_IDS,
  ExerciseKitError,
  checkSpec,
  gradeSubmission,
  implementedExerciseTypes,
  redactSpec,
} from './index.ts';

const spec = {
  options: [
    { id: 'a', text: '`:=`' },
    { id: 'b', text: '`=`' },
    { id: 'c', text: '`==`' },
  ],
  correct: 'a',
};

describe('Go exercise registry', () => {
  it('holds the common choice types and the Go types', () => {
    expect(implementedExerciseTypes()).toEqual([...EXERCISE_TYPE_IDS]);
    expect(EXERCISE_TYPE_IDS).toContain('predict_output');
  });

  it('validates run results with the Go runner contract', () => {
    expect(() =>
      gradeSubmission({
        typeId: 'mcq_single',
        spec,
        answer: { optionId: 'a' },
        run: { status: 'completed' },
      }),
    ).toThrow(ExerciseKitError);
    expect(() =>
      gradeSubmission({
        typeId: 'implement_function',
        spec: {},
        answer: { code: '' },
        run: { marker: 'short', runs: [] },
      }),
    ).toThrow(ExerciseKitError);
  });

  it('grades a choice answer and keeps the key out of the public spec', () => {
    expect(checkSpec('mcq_single', spec)).toMatchObject({ ok: true });
    expect(redactSpec('mcq_single', spec)).not.toHaveProperty('correct');
    const graded = gradeSubmission({ typeId: 'mcq_single', spec, answer: { optionId: 'a' } });
    expect(graded.correct).toBe(true);
  });
});

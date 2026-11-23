import { describe, expect, it } from 'vitest';
import type { ContentExercise } from '../../db/content/repository.ts';
import { candidateOf } from './engine.ts';

function exercise(over: Partial<ContentExercise>): ContentExercise {
  return {
    id: 'c.lesson.ex',
    type: 'mcq_single',
    difficulty: 2,
    lessonId: 'c.lesson',
    usage: 'practice',
    variantGroup: null,
    prompt: '문제',
    code: null,
    spec: {},
    hints: { v: 1, levels: [] },
    explanation: '',
    estimatedSeconds: 60,
    origin: 'authored',
    contentHash: 'h1',
    concepts: [{ conceptId: 'c.a', weight: 1, isPrimary: true }],
    misconceptionIds: [],
    workedExampleStage: null,
    leakFingerprints: [],
    ...over,
  };
}

describe('candidateOf writing flag (JS D-084)', () => {
  it('never marks the choice types, and tolerates a broken spec', () => {
    expect(candidateOf(exercise({ id: 'c', type: 'true_false', spec: {} }))?.writing).toBe(
      undefined,
    );
    expect(candidateOf(exercise({ id: 'd', type: 'mcq_single', spec: {} }))?.writing).toBe(
      undefined,
    );
  });
});

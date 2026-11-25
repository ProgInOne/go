import { findGoToolchain } from '@proginone/go-runner';
import { attemptResponseSchema } from '@proginone/shared';
import { beforeAll, describe, expect, it } from 'vitest';
import { GoService } from '../../services/go/go-service.ts';
import { silentLog, tmpDir } from '../../test/helpers.ts';
import { MINUTE, practiceApp } from '../../test/practice-app.ts';
import { errorCode, lessonSet, type Ctx } from '../../test/practice-flow.ts';

// Code exercises are graded with the server's own run of the learner's Go (G-003).

const lookup = await findGoToolchain();
if (lookup.status !== 'ok' && process.env['CI']) throw new Error('CI needs Go for these tests');

const CODE_EXERCISE = {
  id: 'go-basics.start.first-program.implement-add',
  type: 'implement_function',
  difficulty: 2,
  spec: {
    starter: 'package main\n\nfunc Add(a, b int) int {\n\treturn 0\n}\n',
    solution: 'package main\n\nfunc Add(a, b int) int {\n\treturn a + b\n}\n',
    entry: 'Add',
    checks: [
      { id: 'small', kind: 'call', args: ['3', '4'], want: ['7'] },
      { id: 'hidden', kind: 'call', args: ['10', '20'], want: ['30'], hidden: true },
    ],
  },
};

async function codeItem(ctx: Ctx) {
  const set = await lessonSet(ctx);
  const item = set.items.find((i) => i.exerciseId === CODE_EXERCISE.id);
  if (!item) throw new Error('the lesson set misses the code exercise');
  return item;
}

function submitCode(ctx: Ctx, item: { id: string; exerciseId: string }, code: string, extra = {}) {
  ctx.clock.now += MINUTE;
  return ctx.call('POST', '/attempts', {
    practiceSetItemId: item.id,
    exerciseId: item.exerciseId,
    answer: { code },
    confidence: 'sure',
    startedAt: ctx.clock.now - 40_000,
    activeMs: 30_000,
    ...extra,
  });
}

describe('code exercise attempts', () => {
  it('answer 409 without Go and never take a run result from the client', async () => {
    const ctx = await practiceApp({ extraExercises: [CODE_EXERCISE] });
    const item = await codeItem(ctx);
    const res = await submitCode(ctx, item, CODE_EXERCISE.spec.solution);
    expect(res.status).toBe(409);
    expect(errorCode(res.json)).toBe('EXERCISE_NOT_RUNNABLE');

    const forged = await submitCode(ctx, item, CODE_EXERCISE.spec.solution, {
      runResult: { marker: 'x'.repeat(32), runs: [] },
    });
    expect(forged.status).toBe(400);
    expect(errorCode(forged.json)).toBe('VALIDATION_RUN_RESULT_INVALID');
  });

  describe.skipIf(lookup.status !== 'ok')('with the real Go', () => {
    const go = new GoService({ dataDir: tmpDir(), contentVersion: null, log: silentLog });
    beforeAll(async () => {
      await go.start();
      await go.warmed;
    }, 180_000);

    it('grades the submitted code by its checks, hiding hidden cases', async () => {
      const ctx = await practiceApp({
        extraExercises: [CODE_EXERCISE],
        codeRunner: { runPlan: (plan) => go.runPlan(plan) },
      });
      const item = await codeItem(ctx);
      const wrong = attemptResponseSchema.parse(
        (await submitCode(ctx, item, CODE_EXERCISE.spec.starter)).json,
      );
      expect(wrong.attempt).toMatchObject({ outcome: 'incorrect' });
      expect(wrong.grade.checkResults).toEqual([
        expect.objectContaining({
          id: 'small',
          passed: false,
          detail: { expected: '7', actual: '0' },
        }),
        expect.objectContaining({ id: 'hidden', passed: false, visible: false }),
      ]);
      expect(JSON.stringify(wrong)).not.toContain('30');

      const right = await submitCode(ctx, item, CODE_EXERCISE.spec.solution);
      expect(right.status).toBe(201);
      expect(attemptResponseSchema.parse(right.json).attempt).toMatchObject({ outcome: 'correct' });
    });
  });
});

import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildRunPlan, executeRunPlan, gradeSubmission } from '@proginone/exercise-kit';
import { createGoRunner, findGoToolchain, type GoRunner } from '@proginone/go-runner';
import { beforeAll, describe, expect, it } from 'vitest';

// implement_function grading against the real Go (G-003): the exercise-kit harness and grader,
// executed the way the server and content:check:run execute them.

const lookup = await findGoToolchain();
if (lookup.status !== 'ok' && process.env['CI']) throw new Error('CI needs Go for these tests');

const MARKER = 'pio-test-marker-0123456789abcdef';

const ADD_STARTER = 'package main\n\nfunc Add(a, b int) int {\n\treturn 0\n}\n';
const ADD_SOLUTION = 'package main\n\nfunc Add(a, b int) int {\n\treturn a + b\n}\n';

const addSpec = {
  starter: ADD_STARTER,
  solution: ADD_SOLUTION,
  entry: 'Add',
  checks: [
    { id: 'small', kind: 'call', args: ['3', '4'], want: ['7'] },
    { id: 'negative', kind: 'call', args: ['-2', '2'], want: ['0'] },
    { id: 'big', kind: 'call', args: ['1000', '2000'], want: ['3000'], hidden: true },
  ],
};

const divideSpec = {
  starter:
    'package main\n\nimport "errors"\n\nfunc Divide(a, b int) (int, error) {\n\treturn 0, errors.New("todo")\n}\n',
  solution:
    'package main\n\nimport "errors"\n\nfunc Divide(a, b int) (int, error) {\n\tif b == 0 {\n\t\treturn 0, errors.New("0으로 나눌 수 없어요")\n\t}\n\treturn a / b, nil\n}\n',
  entry: 'Divide',
  checks: [
    { id: 'ok', kind: 'call', args: ['7', '2'], want: ['3', 'nil'] },
    {
      id: 'zero',
      kind: 'call',
      args: ['1', '0'],
      want: ['0', 'errors.New("0으로 나눌 수 없어요")'],
    },
  ],
};

const programSpec = {
  starter: 'package main\n\nfunc main() {\n}\n',
  solution:
    'package main\n\nimport "fmt"\n\nfunc main() {\n\tvar name string\n\tfmt.Scanln(&name)\n\tfmt.Println("안녕,", name)\n}\n',
  checks: [
    { id: 'gopher', kind: 'stdout', stdin: '고퍼\n', text: '안녕, 고퍼' },
    { id: 'go', kind: 'stdout', stdin: 'Go\n', text: '안녕,', match: 'contains' },
  ],
};

describe.skipIf(lookup.status !== 'ok')('implement_function with the real Go', () => {
  let runner: GoRunner;
  beforeAll(async () => {
    if (lookup.status !== 'ok') return;
    runner = createGoRunner({
      toolchain: lookup.toolchain,
      dataDir: await mkdtemp(join(tmpdir(), 'impl-')),
    });
    await runner.prewarm();
  }, 180_000);

  async function grade(spec: unknown, code: string, marker = MARKER) {
    const plan = buildRunPlan({
      typeId: 'implement_function',
      spec,
      answer: { code },
      purpose: 'grading',
    });
    const run = await executeRunPlan(plan, marker, (input) => runner.run(input));
    return gradeSubmission({ typeId: 'implement_function', spec, answer: { code }, run });
  }

  it('passes the solution and fails the starter, showing expected and actual for visible cases', async () => {
    expect(await grade(addSpec, ADD_SOLUTION)).toMatchObject({
      correct: true,
      score: 1,
      outcome: 'correct',
    });
    const wrong = await grade(addSpec, ADD_STARTER);
    expect(wrong).toMatchObject({ correct: false, engineApplicable: true });
    expect(wrong.checkResults).toEqual([
      expect.objectContaining({
        id: 'small',
        passed: false,
        reason: 'MISMATCH',
        detail: { expected: '7', actual: '0' },
      }),
      expect.objectContaining({ id: 'negative', passed: true }),
      expect.objectContaining({ id: 'big', passed: false, reason: 'MISMATCH', visible: false }),
    ]);
    expect(wrong.checkResults?.[2]).not.toHaveProperty('detail');
  });

  it('compares several results, errors included, in the function result types', async () => {
    expect(await grade(divideSpec, divideSpec.solution)).toMatchObject({ correct: true });
    const lazy = await grade(divideSpec, divideSpec.starter);
    expect(lazy.checkResults?.map((c) => c.passed)).toEqual([false, false]);
  });

  it('reports panics per case and keeps grading the other cases', async () => {
    const code =
      'package main\n\nfunc Add(a, b int) int {\n\tif a < 0 {\n\t\tpanic("음수")\n\t}\n\treturn a + b\n}\n';
    const graded = await grade(addSpec, code);
    expect(graded.checkResults?.map((c) => [c.id, c.passed, c.reason ?? null])).toEqual([
      ['small', true, null],
      ['negative', false, 'PANIC'],
      ['big', true, null],
    ]);
    expect(graded.checkResults?.[1]?.detail).toEqual({ actual: 'panic: 음수' });
  });

  it('explains compile errors without showing the harness', async () => {
    const graded = await grade(addSpec, 'package main\n\nfunc Add(a int) int {\n\treturn a\n}\n');
    expect(graded.correct).toBe(false);
    const message = graded.feedback.find((f) => f.code === 'COMPILE_ERROR')?.message ?? '';
    expect(message).toContain('Add 함수의 이름, 매개변수, 반환값');
    expect(message).not.toContain('zz_harness');
    expect(message).not.toContain('1000');
    const withMain = await grade(addSpec, `${ADD_SOLUTION}\nfunc main() {}\n`);
    expect(withMain.feedback.find((f) => f.code === 'COMPILE_ERROR')?.message).toContain(
      'main 함수 없이 Add 함수만',
    );
  });

  it('ignores result lines the learner prints without the secret marker', async () => {
    const forged =
      'package main\n\nimport "fmt"\n\nfunc Add(a, b int) int {\n\tfmt.Println(`{"id":"small","status":"ok","got":"7","want":"7","ok":true}`)\n\treturn 0\n}\n';
    const graded = await grade(addSpec, forged);
    expect(graded.checkResults?.[0]).toMatchObject({ id: 'small', passed: false });
  });

  it('stops endless loops at the time limit and reports it', async () => {
    const code = 'package main\n\nfunc Add(a, b int) int {\n\tfor {\n\t}\n}\n';
    const graded = await grade(addSpec, code);
    expect(graded.checkResults?.every((c) => c.reason === 'TIMEOUT')).toBe(true);
    expect(graded.feedback.map((f) => f.code)).toContain('TIMEOUT');
  }, 20_000);

  it('grades whole programs by their output for each standard input', async () => {
    expect(await grade(programSpec, programSpec.solution)).toMatchObject({ correct: true });
    const graded = await grade(
      programSpec,
      'package main\n\nimport "fmt"\n\nfunc main() {\n\tfmt.Println("안녕")\n}\n',
    );
    expect(graded.checkResults).toEqual([
      expect.objectContaining({
        id: 'gopher',
        passed: false,
        detail: { expected: '안녕, 고퍼', actual: '안녕' },
      }),
      expect.objectContaining({ id: 'go', passed: false }),
    ]);
  });
});

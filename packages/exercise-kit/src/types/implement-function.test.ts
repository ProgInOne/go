import { describe, expect, it } from 'vitest';
import { checkSpec, gradeSubmission, redactSpec } from '../index.ts';

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

const programSpec = {
  starter: 'package main\n\nfunc main() {\n}\n',
  solution:
    'package main\n\nimport "fmt"\n\nfunc main() {\n\tvar name string\n\tfmt.Scanln(&name)\n\tfmt.Println("안녕,", name)\n}\n',
  checks: [
    { id: 'gopher', kind: 'stdout', stdin: '고퍼\n', text: '안녕, 고퍼' },
    { id: 'go', kind: 'stdout', stdin: 'Go\n', text: '안녕,', match: 'contains' },
  ],
};

describe('implement_function spec', () => {
  it('ties check kinds to entry and keeps hidden cases hidden', () => {
    expect(checkSpec('implement_function', addSpec)).toMatchObject({ ok: true });
    expect(checkSpec('implement_function', { ...addSpec, entry: undefined })).toMatchObject({
      ok: false,
    });
    expect(checkSpec('implement_function', { ...programSpec, entry: 'Add' })).toMatchObject({
      ok: false,
    });
    expect(
      checkSpec('implement_function', { ...addSpec, solution: 'package main\n\nfunc main() {}\n' }),
    ).toMatchObject({ ok: false });
    const pub = redactSpec('implement_function', addSpec) as { checks: unknown[] };
    expect(pub).not.toHaveProperty('solution');
    expect(pub.checks).toEqual([
      {
        id: 'small',
        kind: 'call',
        description: 'Add(3, 4)의 결과가 7',
        hidden: false,
        args: ['3', '4'],
        want: ['7'],
      },
      {
        id: 'negative',
        kind: 'call',
        description: 'Add(-2, 2)의 결과가 0',
        hidden: false,
        args: ['-2', '2'],
        want: ['0'],
      },
      { id: 'big', kind: 'call', description: '숨겨진 사례 3', hidden: true },
    ]);
  });

  it('needs a run result to grade', () => {
    expect(() =>
      gradeSubmission({
        typeId: 'implement_function',
        spec: addSpec,
        answer: { code: ADD_SOLUTION },
      }),
    ).toThrow(/run result/);
  });
});

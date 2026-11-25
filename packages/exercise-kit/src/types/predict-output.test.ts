import { describe, expect, it } from 'vitest';
import { checkSpec, gradeSubmission, leakFingerprints, redactSpec } from '../index.ts';
import { expectedFromObservation, predictOutputSpecSchema } from './predict-output.ts';

const CODE = 'package main\n\nimport "fmt"\n\nfunc main() {\n\tfmt.Println("합계:", 3+4)\n}';

const output = {
  code: CODE,
  answerKind: 'output',
  expected: { kind: 'output', lines: ['합계: 7', '끝'] },
  misconceptionByAnswer: { '합계: 3+4\n끝': 'go.mc.expr-printed-as-text' },
};

const choice = {
  code: CODE,
  answerKind: 'choice',
  choices: [
    { id: 'a', text: '합계: 7' },
    { id: 'b', text: '합계:7' },
    { id: 'c', text: '컴파일 오류가 난다', outcome: 'compile-error' },
  ],
  expected: { kind: 'choice', choiceId: 'a' },
  misconceptionByAnswer: { b: 'go.mc.println-no-space' },
};

const grade = (spec: unknown, answer: unknown) =>
  gradeSubmission({ typeId: 'predict_output', spec, answer });

describe('predict_output', () => {
  it('grades a typed prediction line by line, ignoring trailing spaces and blank lines', () => {
    expect(grade(output, { output: '합계: 7  \n끝\n\n' })).toMatchObject({
      correct: true,
      score: 1,
      feedback: [{ code: 'PREDICT_CORRECT' }],
    });
    const wrong = grade(output, { output: '합계: 3+4\n끝' });
    expect(wrong).toMatchObject({
      correct: false,
      score: 0.5,
      misconceptionIds: ['go.mc.expr-printed-as-text'],
      feedback: [{ code: 'PREDICT_LINE_WRONG', target: '1' }],
    });
    expect(grade(output, { output: '합계: 7' }).feedback).toContainEqual(
      expect.objectContaining({ code: 'PREDICT_LINE_COUNT', message: '출력 줄이 더 있어요.' }),
    );
  });

  it('grades a choice and links a wrong choice to its misconception', () => {
    expect(grade(choice, { choiceId: 'a' }).correct).toBe(true);
    expect(grade(choice, { choiceId: 'b' })).toMatchObject({
      correct: false,
      misconceptionIds: ['go.mc.println-no-space'],
    });
  });

  it('refuses an answer of the other kind and a spec without its run', () => {
    expect(() => grade(choice, { output: '합계: 7' })).toThrow(/answerKind/);
    expect(() => grade({ ...output, expected: undefined }, { output: 'x' })).toThrow(
      /expected value/,
    );
  });

  it('keeps the answer key and choice outcomes out of the public spec', () => {
    expect(redactSpec('predict_output', { ...choice, stdin: 'go\n' })).toEqual({
      code: CODE,
      stdin: 'go\n',
      answerKind: 'choice',
      choices: [
        { id: 'a', text: '합계: 7' },
        { id: 'b', text: '합계:7' },
        { id: 'c', text: '컴파일 오류가 난다' },
      ],
    });
    expect(leakFingerprints('predict_output', output).length).toBeGreaterThan(0);
  });

  it('checks the spec shape and asks for the run when the key is missing', () => {
    expect(checkSpec('predict_output', { code: CODE, answerKind: 'choice' })).toMatchObject({
      ok: false,
    });
    expect(
      checkSpec('predict_output', { code: CODE, answerKind: 'output', choices: choice.choices }),
    ).toMatchObject({ ok: false });
    expect(checkSpec('predict_output', { code: CODE, answerKind: 'output' })).toMatchObject({
      ok: true,
      warnings: [expect.stringContaining('content:check:run')],
    });
    expect(
      checkSpec('predict_output', { ...choice, misconceptionByAnswer: { a: 'go.mc.x' } }),
    ).toMatchObject({ ok: false });
  });
});

describe('expectedFromObservation', () => {
  const parse = (raw: unknown) => predictOutputSpecSchema.parse(raw);
  const { expected: _o, ...outputSpec } = output;
  const { expected: _c, ...choiceSpec } = choice;

  it('takes the printed lines for an output question', () => {
    expect(
      expectedFromObservation(parse(outputSpec), { kind: 'output', stdout: '합계: 7 \n끝\n' }),
    ).toEqual({ ok: true, expected: { kind: 'output', lines: ['합계: 7', '끝'] } });
    const panicked = expectedFromObservation(parse(outputSpec), { kind: 'panic' });
    expect(panicked.ok).toBe(false);
    expect(panicked.ok ? '' : panicked.message).toContain('panic');
  });

  it('picks the one choice that matches what happened', () => {
    expect(
      expectedFromObservation(parse(choiceSpec), { kind: 'output', stdout: '합계: 7\n' }),
    ).toEqual({ ok: true, expected: { kind: 'choice', choiceId: 'a' } });
    expect(expectedFromObservation(parse(choiceSpec), { kind: 'compile-error' })).toEqual({
      ok: true,
      expected: { kind: 'choice', choiceId: 'c' },
    });
    expect(expectedFromObservation(parse(choiceSpec), { kind: 'panic' })).toMatchObject({
      ok: false,
      message: '실제 결과(panic)와 같은 보기가 없습니다',
    });
    expect(
      expectedFromObservation(parse(choiceSpec), { kind: 'other', reason: 'timeout' }),
    ).toMatchObject({ ok: false });
  });
});

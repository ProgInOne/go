import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ExerciseRenderer,
  initialAnswer,
  isAnswerReady,
  notReadyReason,
  parsePublicSpec,
  type AnswerByType,
  type RenderableExercise,
  type RenderableTypeId,
} from './exercise.tsx';

afterEach(() => {
  vi.unstubAllGlobals();
});

const CODE = 'package main\n\nimport "fmt"\n\nfunc main() {\n\tfmt.Println("합계:", 3+4)\n}';

function Harness({ exercise, seen }: { exercise: RenderableExercise; seen: unknown[] }) {
  const [answer, setAnswer] = useState<AnswerByType[RenderableTypeId]>(() =>
    initialAnswer(exercise),
  );
  return (
    <>
      <ExerciseRenderer
        exercise={exercise}
        value={answer}
        onChange={(a) => {
          seen.push(a);
          setAnswer(a);
        }}
      />
      <p>{isAnswerReady(exercise, answer) ? '제출 가능' : notReadyReason(exercise)}</p>
    </>
  );
}

describe('predict_output in the web app', () => {
  it('parses only valid public specs', () => {
    expect(parsePublicSpec('predict_output', { code: CODE, answerKind: 'output' })).toEqual({
      typeId: 'predict_output',
      spec: { code: CODE, answerKind: 'output' },
    });
    expect(parsePublicSpec('predict_output', { code: CODE })).toBeNull();
    expect(parsePublicSpec('implement_function', {})).toBeNull();
  });

  it('takes a typed prediction under the program and its input', async () => {
    const exercise = parsePublicSpec('predict_output', {
      code: CODE,
      stdin: '고퍼\n',
      answerKind: 'output',
    });
    if (!exercise) throw new Error('spec');
    const seen: unknown[] = [];
    render(<Harness exercise={exercise} seen={seen} />);
    expect(screen.getByText('예상한 출력을 적어 주세요')).toBeInTheDocument();
    expect(screen.getByText('표준 입력')).toBeInTheDocument();
    await userEvent.setup().type(screen.getByLabelText('예상한 출력'), '합계: 7');
    expect(seen.at(-1)).toEqual({ output: '합계: 7' });
    expect(screen.getByText('제출 가능')).toBeInTheDocument();
  });

  it('offers the outcome choices as single-choice cards', async () => {
    const exercise = parsePublicSpec('predict_output', {
      code: CODE,
      answerKind: 'choice',
      choices: [
        { id: 'a', text: '`합계: 7`' },
        { id: 'b', text: '컴파일 오류가 난다' },
      ],
    });
    if (!exercise) throw new Error('spec');
    const seen: unknown[] = [];
    render(<Harness exercise={exercise} seen={seen} />);
    expect(screen.getByText('보기를 골라 주세요')).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('radio', { name: /컴파일 오류가 난다/ }));
    expect(seen.at(-1)).toEqual({ choiceId: 'b' });
    expect(screen.getByText('제출 가능')).toBeInTheDocument();
  });
});

describe('implement_function in the web app', () => {
  const spec = {
    starter: 'package main\n\nfunc Add(a, b int) int {\n\treturn 0\n}\n',
    entry: 'Add',
    checks: [
      {
        id: 'small',
        kind: 'call',
        description: 'Add(3, 4)의 결과가 7',
        hidden: false,
        args: ['3', '4'],
        want: ['7'],
      },
      { id: 'big', kind: 'call', description: '숨겨진 사례 2', hidden: true },
    ],
  };

  it('starts from the starter code and lists the cases, hidden ones by name only', async () => {
    const exercise = parsePublicSpec('implement_function', spec);
    if (!exercise) throw new Error('spec');
    expect(initialAnswer(exercise)).toEqual({ code: spec.starter });
    expect(isAnswerReady(exercise, { code: '  ' })).toBe(false);
    // Go is ready: the toolchain query answers ok.
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              status: 'ok',
              version: 'go1.27.3',
              goBin: '/go/bin/go',
              minVersion: 'go1.22',
              contentVersion: 'go1.27.3',
              matchesContentVersion: true,
              searched: [],
            }),
            { headers: { 'content-type': 'application/json' } },
          ),
        ),
      ),
    );
    render(
      <QueryClientProvider client={new QueryClient()}>
        <Harness exercise={exercise} seen={[]} />
      </QueryClientProvider>,
    );
    expect(screen.getByText('Add(3, 4)의 결과가 7')).toBeInTheDocument();
    expect(screen.getByText('숨겨진 사례 2')).toBeInTheDocument();
    expect(screen.getByText('main', { selector: 'code' })).toBeInTheDocument();
    expect(await screen.findByRole('textbox', { name: '코드 편집 (main.go)' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: '코드 작성' })).toHaveClass('workbench');
    expect(screen.getByText('제출 가능')).toBeInTheDocument();
  });

  it('rejects a public spec of the wrong shape', () => {
    expect(parsePublicSpec('implement_function', { starter: 1 })).toBeNull();
  });
});

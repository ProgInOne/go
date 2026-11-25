import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
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

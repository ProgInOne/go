import type { PredictOutputAnswer, PredictOutputPublicSpec } from '@proginone/exercise-kit';
import { CodeBlock, McqSingle } from '@proginone/exercise-ui';
import { useId } from 'react';

/** Answer while editing: typed output, or the picked choice (null until one is picked). */
export type PredictOutputDraft = { output: string } | { choiceId: string } | null;

export interface PredictOutputProps {
  spec: PredictOutputPublicSpec;
  value: PredictOutputDraft;
  onChange: (answer: PredictOutputAnswer) => void;
  disabled?: boolean;
  labelledBy?: string;
}

/**
 * `predict_output` (G-002): the program, its standard input if any, then either a box for the
 * whole predicted output or the outcome choices (the shared single-choice cards).
 */
export function PredictOutput({ spec, value, onChange, disabled, labelledBy }: PredictOutputProps) {
  const outputId = useId();
  return (
    <div className="grid gap-3">
      <CodeBlock code={spec.code} language="go" />
      {spec.stdin !== undefined && (
        <div>
          <p className="mb-1 font-semibold text-fg-secondary type-small">표준 입력</p>
          <pre className="m-0 rounded-md bg-subtle px-3 py-2 font-mono text-[14px] whitespace-pre-wrap">
            {spec.stdin}
          </pre>
        </div>
      )}
      {spec.answerKind === 'output' ? (
        <div className="grid gap-1">
          <label htmlFor={outputId} className="font-medium">
            예상한 출력
          </label>
          <textarea
            id={outputId}
            rows={4}
            value={value !== null && 'output' in value ? value.output : ''}
            disabled={disabled}
            spellCheck={false}
            aria-describedby={labelledBy}
            onChange={(e) => {
              onChange({ output: e.target.value });
            }}
            className="rounded-md border border-(--color-border-input) bg-surface px-3 py-2 font-mono text-fg"
          />
          <p className="m-0 text-fg-tertiary type-small">
            출력되는 그대로, 한 줄에 한 줄씩 적어요. 줄 끝 공백은 따지지 않아요.
          </p>
        </div>
      ) : (
        <McqSingle
          spec={{ options: spec.choices ?? [], codeOptions: false }}
          value={value !== null && 'choiceId' in value ? { optionId: value.choiceId } : null}
          onChange={(a) => {
            onChange({ choiceId: a.optionId });
          }}
          {...(disabled === undefined ? {} : { disabled })}
          {...(labelledBy === undefined ? {} : { labelledBy })}
        />
      )}
    </div>
  );
}

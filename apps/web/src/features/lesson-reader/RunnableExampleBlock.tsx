import {
  ariaShortcut,
  FormatError,
  Kbd,
  matchExerciseShortcut,
  modKeyLabel,
  type CodeEditorHandle,
} from '@proginone/exercise-ui';
import { Button } from '@proginone/ui';
import { AlignLeft, Pencil, Play, RotateCcw } from 'lucide-react';
import { lazy, Suspense, useId, useRef, useState } from 'react';
import { runGo, useGoToolchain, type GoRunResponse } from '../go/api.ts';
import { compileErrorLines, RunOutput } from '../go/RunOutput.tsx';
import { ToolchainNotice } from '../go/ToolchainNotice.tsx';

const GoEditor = lazy(() => import('../go/GoEditor.tsx'));

/**
 * Lesson Go example the learner runs on the local server (G-002, `<RunnableExample lang="go">`).
 * With `predict`, the learner writes down the expected output before the first run. With
 * `editable`, "코드 수정" opens the Go editor (gofmt with ⇧⌥F or the button); "원래 코드로"
 * restores the lesson's code. Edits are not saved yet.
 */
export function RunnableExampleBlock({
  id,
  code: original,
  predict,
  allowSkip = true,
  editable = false,
  expectError = false,
}: {
  id: string;
  code: string;
  predict: boolean;
  /** "예측 건너뛰기" link; hidden when the learner set predict-first to required. */
  allowSkip?: boolean;
  editable?: boolean;
  /** The example is meant to fail to compile; the output says so. */
  expectError?: boolean;
}) {
  const toolchain = useGoToolchain();
  const ready = toolchain.data?.status === 'ok';
  const [code, setCode] = useState(original);
  const [editing, setEditing] = useState(false);
  const [prediction, setPrediction] = useState('');
  const [skipped, setSkipped] = useState(false);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<GoRunResponse | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [formatNote, setFormatNote] = useState<string | null>(null);
  const editor = useRef<CodeEditorHandle>(null);
  const titleId = `example-${id}`;
  const predictionId = useId();

  const canRun = ready && (!predict || skipped || prediction.trim() !== '' || result !== null);

  const run = async () => {
    setRunning(true);
    setFailure(null);
    try {
      setResult(await runGo(code));
    } catch (e) {
      setFailure(e instanceof Error ? e.message : '실행하지 못했어요.');
    } finally {
      setRunning(false);
    }
  };

  const format = async () => {
    setFormatNote(null);
    try {
      await editor.current?.format();
    } catch (e) {
      setFormatNote(
        e instanceof FormatError
          ? `문법 오류가 있어서 정리하지 못했어요${e.line ? ` (${String(e.line)}번째 줄)` : ''}.`
          : '코드를 정리하지 못했어요.',
      );
    }
  };

  const expectedFailure =
    expectError && result?.phase === 'compile' && result.compile.reason === 'compile-error';

  return (
    <figure
      className="lesson-example"
      aria-labelledby={titleId}
      // ⌘Enter (Ctrl+Enter) runs the example from anywhere inside it.
      onKeyDown={(e) => {
        if (e.nativeEvent.isComposing || matchExerciseShortcut(e) !== 'onSubmit') return;
        e.preventDefault();
        if (canRun && !running) void run();
      }}
    >
      <figcaption id={titleId} className="lesson-example__header">
        <span>예제 · Go</span>
        {predict && (
          <span className="font-normal text-fg-tertiary">실행 전에 결과를 예측해 보세요</span>
        )}
      </figcaption>
      {editing ? (
        <div className="lesson-example__editor">
          <Suspense
            fallback={
              <pre className="lesson-code m-0 rounded-none border-0">
                <code>{code}</code>
              </pre>
            }
          >
            <GoEditor
              ref={editor}
              value={code}
              onChange={setCode}
              label="예제 코드 편집 (Go)"
              errorLines={compileErrorLines(result)}
              onFormatError={(e) => {
                setFormatNote(
                  `문법 오류가 있어서 정리하지 못했어요${e.line ? ` (${String(e.line)}번째 줄)` : ''}.`,
                );
              }}
            />
          </Suspense>
        </div>
      ) : (
        <pre className="lesson-code m-0 rounded-none border-0">
          <code>{code}</code>
        </pre>
      )}

      <div className="lesson-example__footer flex-col items-stretch gap-2">
        {predict && !result && (
          <div className="grid gap-1">
            <label htmlFor={predictionId} className="font-medium">
              예상한 출력
            </label>
            <textarea
              id={predictionId}
              rows={2}
              value={prediction}
              onChange={(e) => {
                setPrediction(e.target.value);
              }}
              className="rounded-md border border-(--color-border-input) bg-surface px-3 py-2 font-mono text-fg"
            />
          </div>
        )}
        <ToolchainNotice status={toolchain.data} />
        <div className="flex flex-wrap items-center justify-end gap-2">
          {editing && (
            <span className="mr-auto text-fg-tertiary type-small" role="status">
              {code === original ? '원래 코드' : '수정한 코드(저장되지 않아요)'}
            </span>
          )}
          {editable && !editing && (
            <Button
              variant="ghost"
              size="sm"
              icon={<Pencil size={16} />}
              onClick={() => {
                setEditing(true);
              }}
            >
              코드 수정
            </Button>
          )}
          {editing && ready && (
            <Button
              variant="ghost"
              size="sm"
              icon={<AlignLeft size={16} />}
              onClick={() => {
                void format();
              }}
            >
              gofmt로 정리
            </Button>
          )}
          {editing && (
            <Button
              variant="ghost"
              size="sm"
              icon={<RotateCcw size={16} />}
              onClick={() => {
                setCode(original);
                setEditing(false);
                setFormatNote(null);
              }}
            >
              원래 코드로
            </Button>
          )}
          {predict && allowSkip && !result && !skipped && prediction.trim() === '' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSkipped(true);
              }}
            >
              예측 건너뛰기
            </Button>
          )}
          <Button
            size="sm"
            icon={<Play size={16} />}
            loading={running}
            disabled={!canRun}
            aria-keyshortcuts={ariaShortcut('Enter')}
            onClick={() => {
              void run();
            }}
          >
            {result ? '다시 실행' : '실행'}
            <Kbd keys={[modKeyLabel(), 'Enter']} />
          </Button>
        </div>
        {formatNote && (
          <p className="m-0 text-fg-secondary type-small" role="status">
            {formatNote}
          </p>
        )}
      </div>

      {(result ?? failure) && (
        <div className="border-t border-line px-4 py-3" role="status" aria-live="polite">
          {failure && <p className="m-0 text-fg-secondary">{failure}</p>}
          {predict && result && prediction.trim() !== '' && (
            <p className="mb-2 text-fg-secondary type-small">
              내 예측: <span className="font-mono text-fg">{prediction.trim()}</span>
            </p>
          )}
          {expectedFailure && (
            <p className="mb-2 text-fg-secondary">
              이 예제는 컴파일 오류를 보여 주는 예제예요. 오류 메시지를 읽어 보세요.
            </p>
          )}
          {result && <RunOutput result={result} />}
        </div>
      )}
    </figure>
  );
}

import type { ImplementFunctionAnswer, ImplementFunctionPublicSpec } from '@proginone/exercise-kit';
import { FormatError, type CodeEditorHandle } from '@proginone/exercise-ui';
import { Button } from '@proginone/ui';
import { AlignLeft, Play, RotateCcw } from 'lucide-react';
import { lazy, Suspense, useRef, useState } from 'react';
import { runGo, useGoToolchain, type GoRunResponse } from '../go/api.ts';
import { compileErrorLines, RunOutput } from '../go/RunOutput.tsx';
import { ToolchainNotice } from '../go/ToolchainNotice.tsx';

const GoEditor = lazy(() => import('../go/GoEditor.tsx'));

export interface ImplementFunctionProps {
  spec: ImplementFunctionPublicSpec;
  value: ImplementFunctionAnswer;
  onChange: (answer: ImplementFunctionAnswer) => void;
  disabled?: boolean;
  labelledBy?: string;
}

/**
 * `implement_function` (G-003): the Go editor in the workbench, the cases the server will check
 * (hidden ones only by name), gofmt and "처음 코드로". A whole-program exercise (no `entry`) can
 * also be run freely, with the first visible case's standard input; grading is "제출".
 */
export function ImplementFunction({
  spec,
  value,
  onChange,
  disabled,
  labelledBy,
}: ImplementFunctionProps) {
  const toolchain = useGoToolchain();
  const ready = toolchain.data?.status === 'ok';
  const editor = useRef<CodeEditorHandle>(null);
  const [note, setNote] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<GoRunResponse | null>(null);
  const program = spec.entry === undefined;
  const sampleInput = spec.checks.find((c) => !c.hidden && c.stdin !== undefined)?.stdin ?? '';

  const format = async () => {
    setNote(null);
    try {
      await editor.current?.format();
    } catch (e) {
      setNote(
        e instanceof FormatError
          ? `문법 오류가 있어서 정리하지 못했어요${e.line ? ` (${String(e.line)}번째 줄)` : ''}.`
          : '코드를 정리하지 못했어요.',
      );
    }
  };

  const run = async () => {
    setRunning(true);
    setNote(null);
    try {
      setResult(await runGo(value.code, sampleInput));
    } catch (e) {
      setNote(e instanceof Error ? e.message : '실행하지 못했어요.');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="grid gap-3">
      {spec.entry !== undefined && (
        <p className="m-0 text-fg-secondary">
          <code>{spec.entry}</code> 함수를 완성해요. <code>main</code> 함수는 쓰지 않아요.
        </p>
      )}
      <div>
        <p className="mb-1 font-semibold text-fg-secondary type-small">확인하는 사례</p>
        <ul className="m-0 grid gap-1 pl-5 type-small">
          {spec.checks.map((c) => (
            <li key={c.id}>
              {c.description}
              {!c.hidden && c.stdin !== undefined && (
                <span className="text-fg-tertiary"> (입력: {JSON.stringify(c.stdin)})</span>
              )}
            </li>
          ))}
        </ul>
      </div>
      <section className="workbench grid gap-2" aria-label="코드 작성">
        <Suspense
          fallback={
            <pre className="m-0 rounded-md bg-subtle p-3 font-mono text-[14px]">
              <code>{value.code}</code>
            </pre>
          }
        >
          <GoEditor
            ref={editor}
            value={value.code}
            onChange={(code) => {
              onChange({ code });
            }}
            label="코드 편집 (main.go)"
            readOnly={disabled ?? false}
            errorLines={compileErrorLines(result)}
            {...(labelledBy === undefined ? {} : { describedBy: labelledBy })}
            onFormatError={(e) => {
              setNote(
                `문법 오류가 있어서 정리하지 못했어요${e.line ? ` (${String(e.line)}번째 줄)` : ''}.`,
              );
            }}
          />
        </Suspense>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            icon={<RotateCcw size={16} />}
            disabled={disabled}
            onClick={() => {
              onChange({ code: spec.starter });
              setResult(null);
            }}
          >
            처음 코드로
          </Button>
          {ready && (
            <Button
              variant="ghost"
              size="sm"
              icon={<AlignLeft size={16} />}
              disabled={disabled}
              onClick={() => {
                void format();
              }}
            >
              gofmt로 정리
            </Button>
          )}
          {program && (
            <Button
              variant="secondary"
              size="sm"
              icon={<Play size={16} />}
              loading={running}
              disabled={!ready || disabled}
              onClick={() => {
                void run();
              }}
            >
              실행
            </Button>
          )}
        </div>
        <ToolchainNotice status={toolchain.data} />
        {note && (
          <p className="m-0 text-fg-secondary type-small" role="status">
            {note}
          </p>
        )}
        {result && (
          <div className="rounded-md border border-line px-3 py-2" role="status" aria-live="polite">
            <RunOutput result={result} />
          </div>
        )}
      </section>
    </div>
  );
}

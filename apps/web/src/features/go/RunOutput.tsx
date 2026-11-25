import type { GoRunResponse } from './api.ts';
import { runStatusMessage, virtualTimeNote } from './messages.ts';

/**
 * What a Go run printed (G-002): compiler errors as the compiler wrote them, or standard output
 * and standard error, then why the run stopped and a note about virtual time.
 */
export function RunOutput({ result }: { result: GoRunResponse }) {
  const status = runStatusMessage(result);
  const note = virtualTimeNote(result);
  const block = 'm-0 whitespace-pre-wrap break-words font-mono text-[14px]';
  return (
    <div className="grid gap-2">
      {result.phase === 'compile' ? (
        result.compile.reason === 'compile-error' && (
          <div>
            <p className="mb-1 font-semibold text-fg-secondary type-small">컴파일 오류</p>
            <pre
              className={`${block} text-(--color-feedback-incorrect-fg)`}
              aria-label="컴파일 오류"
            >
              {result.compile.output}
            </pre>
          </div>
        )
      ) : (
        <>
          <div>
            <p className="mb-1 font-semibold text-fg-secondary type-small">출력</p>
            {result.run.stdout === '' && result.run.stderr === '' ? (
              <p className="m-0 text-fg-tertiary type-small">출력이 없어요.</p>
            ) : (
              result.run.stdout !== '' && (
                <pre className={block} aria-label="표준 출력">
                  {result.run.stdout}
                </pre>
              )
            )}
          </div>
          {result.run.stderr !== '' && (
            <div>
              <p className="mb-1 font-semibold text-fg-secondary type-small">오류 출력</p>
              <pre
                className={`${block} text-(--color-feedback-incorrect-fg)`}
                aria-label="표준 오류"
              >
                {result.run.stderr}
              </pre>
            </div>
          )}
        </>
      )}
      {status && <p className="m-0 text-fg-secondary">{status}</p>}
      {note && <p className="m-0 text-fg-tertiary type-small">{note}</p>}
    </div>
  );
}

/** 1-based lines of `main.go` the compiler complained about. */
export function compileErrorLines(result: GoRunResponse | null): number[] {
  if (result?.phase !== 'compile' || result.compile.reason !== 'compile-error') return [];
  return [
    ...new Set(result.compile.diagnostics.filter((d) => d.file === 'main.go').map((d) => d.line)),
  ];
}

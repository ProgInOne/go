import { Button, ErrorState, Skeleton } from '@proginone/ui';
import { createFileRoute } from '@tanstack/react-router';
import { RefreshCw } from 'lucide-react';
import { cardClass, pageTitleClass } from '../../app/layout.ts';
import { useGoToolchain, useRefreshGoToolchain, type GoToolchain } from '../../features/go/api.ts';
import { toolchainProblem } from '../../features/go/messages.ts';

export const Route = createFileRoute('/settings/go')({
  component: GoSettings,
});

/**
 * 설정 > Go 실행 환경 (G-002): which Go the app found, how to install one, and a way to look
 * again without restarting the app.
 */
function GoSettings() {
  const toolchain = useGoToolchain();
  const refresh = useRefreshGoToolchain();

  return (
    <section aria-labelledby="go-title" className="max-w-[760px]">
      <h1 id="go-title" className={pageTitleClass}>
        Go 실행 환경
      </h1>
      <div className={`${cardClass} grid gap-4`}>
        {toolchain.isPending ? (
          <Skeleton height={96} />
        ) : toolchain.isError ? (
          <ErrorState
            variant="inline"
            title="Go 상태를 불러오지 못했어요"
            description={toolchain.error.message}
          />
        ) : (
          <ToolchainDetails status={toolchain.data} />
        )}
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="secondary"
            size="sm"
            icon={<RefreshCw size={16} />}
            loading={refresh.isPending}
            onClick={() => {
              refresh.mutate();
            }}
          >
            Go 다시 찾기
          </Button>
          {refresh.isError && (
            <span className="text-fg-secondary type-small" role="status">
              다시 찾지 못했어요: {refresh.error.message}
            </span>
          )}
        </div>
        <p className="m-0 text-fg-tertiary type-small">
          코드는 이 컴퓨터의 Go로 컴파일하고, 파일과 네트워크에 접근할 수 없는 격리된 환경에서
          실행해요. 다른 위치의 Go를 쓰려면 앱 데이터 폴더의 <code>config.json</code>에{' '}
          <code>goPath</code>를 적어요.
        </p>
      </div>
    </section>
  );
}

function ToolchainDetails({ status }: { status: GoToolchain }) {
  const problem = toolchainProblem(status);
  return (
    <div className="grid gap-2">
      {problem ? (
        <>
          <p className="m-0 font-semibold">{problem}</p>
          <p className="m-0 text-fg-secondary">
            <a href="https://go.dev/dl/" target="_blank" rel="noreferrer">
              go.dev/dl
            </a>
            에서 Go {status.minVersion.slice(2)} 이상을 설치한 뒤 "Go 다시 찾기"를 눌러요. 레슨
            읽기와 선택형 문제는 Go 없이도 할 수 있어요.
          </p>
          {status.searched.length > 0 && (
            <details className="text-fg-secondary type-small">
              <summary>찾아본 위치</summary>
              <ul className="m-0 mt-1 pl-5 font-mono">
                {status.searched.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </details>
          )}
        </>
      ) : (
        <dl className="m-0 grid grid-cols-[max-content_minmax(0,1fr)] gap-x-4 gap-y-1">
          <dt className="text-fg-secondary">버전</dt>
          <dd className="m-0 font-mono">{status.version}</dd>
          <dt className="text-fg-secondary">위치</dt>
          <dd className="m-0 font-mono break-all">{status.goBin}</dd>
        </dl>
      )}
      {status.matchesContentVersion === false && status.contentVersion && (
        <p className="m-0 text-fg-secondary type-small" role="note">
          콘텐츠의 실행 결과는 {status.contentVersion}로 확인했어요. 버전이 달라서 출력이나 오류
          문구가 조금 다를 수 있어요.
        </p>
      )}
    </div>
  );
}

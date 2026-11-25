import type { GoRunResponse, GoToolchain } from './api.ts';

/** Why a run stopped, in words for the learner (G-002 limits); null for a normal end. */
export function runStatusMessage(result: GoRunResponse): string | null {
  if (result.phase === 'compile') {
    switch (result.compile.reason) {
      case 'compile-error':
        return '컴파일 오류가 있어서 실행하지 못했어요.';
      case 'timeout':
        return '컴파일이 30초 안에 끝나지 않았어요.';
      case 'output-limit':
        return '컴파일 오류 메시지가 너무 길어서 멈췄어요.';
    }
  }
  const { reason, exitCode } = result.run;
  switch (reason) {
    case 'exit':
      return exitCode === 0 ? null : `프로그램이 종료 코드 ${String(exitCode)}로 끝났어요.`;
    case 'panic':
      return '프로그램이 panic으로 멈췄어요. 아래 오류 메시지의 첫 줄과 줄 번호를 확인해 보세요.';
    case 'fatal':
      return 'Go 런타임이 프로그램을 멈췄어요(fatal error).';
    case 'memory':
      return '메모리를 너무 많이 써서 멈췄어요(256MB 한도).';
    case 'timeout':
      return '5초 안에 끝나지 않아서 멈췄어요. 끝나지 않는 반복문이 있는지 확인해 보세요.';
    case 'output-limit':
      return '출력이 너무 많아서(64KB) 멈췄어요.';
    case 'crash':
      return '실행 환경에 문제가 생겼어요. 다시 실행해 보세요.';
  }
}

/** Sleeps run on a virtual clock (G-002): say so when the program slept. */
export function virtualTimeNote(result: GoRunResponse): string | null {
  if (result.phase !== 'run' || result.run.virtualMs <= 0) return null;
  const ms = result.run.virtualMs;
  const amount = ms >= 1000 ? `${String(Math.round(ms / 100) / 10)}초` : `${String(ms)}ms`;
  return `time.Sleep 같은 대기(${amount})는 실제로 기다리지 않고 바로 넘겼어요.`;
}

/** Why runs are off, or null when Go is ready. */
export function toolchainProblem(status: GoToolchain): string | null {
  switch (status.status) {
    case 'ok':
      return null;
    case 'missing':
      return 'Go가 설치되어 있지 않아서 코드를 실행할 수 없어요.';
    case 'too-old':
      return `Go ${status.minVersion.slice(2)} 이상이 필요해요. 지금 Go는 ${status.version ?? '알 수 없는 버전'}이에요.`;
    case 'broken':
      return 'Go를 찾았지만 실행하지 못했어요. 설치 상태를 확인해 주세요.';
  }
}

/** How failed code checks read in the result banner (JS D-097: the language owns its checks). */
export const GO_CHECK_LABELS = {
  kind: (kind: string): string | undefined => ({ call: '함수 호출', stdout: '출력' })[kind],
  reason: (reason: string): string | undefined =>
    (
      ({
        MISMATCH: '결과가 달라요',
        PANIC: 'panic이 났어요',
        TIMEOUT: '시간 안에 끝나지 않았어요',
        MEMORY: '메모리를 너무 많이 썼어요',
        OUTPUT_LIMIT: '출력이 너무 많아요',
        FATAL: 'Go 런타임이 멈췄어요',
        EXIT_CODE: '0이 아닌 종료 코드로 끝났어요',
        COMPILE_ERROR: '컴파일 오류',
        COMPILE_TIMEOUT: '컴파일 시간 초과',
        NO_RESULT: '결과가 없어요',
        CRASH: '실행 환경 문제',
      }) as Record<string, string>
    )[reason],
};

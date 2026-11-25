import { Link } from '@tanstack/react-router';
import type { GoToolchain } from './api.ts';
import { toolchainProblem } from './messages.ts';

/** Why runs are off, with a way to the Go settings; nothing when Go is ready. */
export function ToolchainNotice({ status }: { status: GoToolchain | undefined }) {
  const problem = status ? toolchainProblem(status) : null;
  if (!problem) return null;
  return (
    <p className="m-0 text-fg-secondary type-small" role="note">
      {problem}{' '}
      <Link to="/settings/go" className="font-medium">
        Go 실행 환경 설정
      </Link>
    </p>
  );
}

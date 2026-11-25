import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { GoToolchain } from '../../features/go/api.ts';
import { renderApp } from '../../test/render-app.tsx';

afterEach(() => {
  vi.unstubAllGlobals();
});

const MISSING: GoToolchain = {
  status: 'missing',
  version: null,
  goBin: null,
  minVersion: 'go1.22',
  contentVersion: 'go1.27.3',
  matchesContentVersion: null,
  searched: ['/usr/local/go/bin/go'],
};

describe('설정 > Go 실행 환경', () => {
  it('guides installing Go and finds it again without a restart', async () => {
    let status = MISSING;
    const { calls } = renderApp('/settings/go', (method, path) => {
      if (path === '/go/toolchain/refresh') {
        status = {
          ...MISSING,
          status: 'ok',
          version: 'go1.26.1',
          goBin: '/opt/homebrew/bin/go',
          matchesContentVersion: false,
          searched: [],
        };
      }
      if (path.startsWith('/go/toolchain')) return { body: status };
      return {
        status: 404,
        body: { error: { code: 'NOT_FOUND', message: path, retryable: false } },
      };
    });
    expect(await screen.findByRole('heading', { level: 1, name: 'Go 실행 환경' })).toBeVisible();
    expect(
      await screen.findByText('Go가 설치되어 있지 않아서 코드를 실행할 수 없어요.'),
    ).toBeVisible();
    expect(screen.getByRole('link', { name: 'go.dev/dl' })).toHaveAttribute(
      'href',
      'https://go.dev/dl/',
    );
    expect(screen.getByText('/usr/local/go/bin/go')).toBeInTheDocument();

    await userEvent.setup().click(screen.getByRole('button', { name: 'Go 다시 찾기' }));
    expect(await screen.findByText('go1.26.1')).toBeVisible();
    expect(screen.getByRole('note')).toHaveTextContent('go1.27.3로 확인했어요');
    expect(calls.some((c) => c.method === 'POST' && c.path === '/go/toolchain/refresh')).toBe(true);
    expect(
      within(screen.getByRole('navigation', { name: '설정 섹션' })).getByRole('link', {
        name: 'Go 실행 환경',
      }),
    ).toHaveAttribute('aria-current', 'page');
  });
});

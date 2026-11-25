import { SETTINGS_DEFAULTS } from '@proginone/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { GoRunResponse, GoToolchain } from '../go/api.ts';
import { RunnableExampleBlock } from './RunnableExampleBlock.tsx';

afterEach(() => {
  vi.unstubAllGlobals();
});

const READY: GoToolchain = {
  status: 'ok',
  version: 'go1.27.3',
  goBin: '/usr/local/go/bin/go',
  minVersion: 'go1.22',
  contentVersion: 'go1.27.3',
  matchesContentVersion: true,
  searched: [],
};

const CODE = 'package main\n\nimport "fmt"\n\nfunc main() {\n\tfmt.Println("합계:", 3+4)\n}';

function setup(options: {
  toolchain?: GoToolchain;
  run?: GoRunResponse;
  props?: Partial<Parameters<typeof RunnableExampleBlock>[0]>;
}) {
  const runs: unknown[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((input: string, init: RequestInit = {}) => {
      const path = input.replace(/^\/api\/v1/, '');
      const json = (body: unknown) =>
        Promise.resolve(
          new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } }),
        );
      if (path === '/go/toolchain') return json(options.toolchain ?? READY);
      if (path === '/settings') return json(SETTINGS_DEFAULTS);
      if (path === '/go/run') {
        runs.push(JSON.parse(init.body as string));
        return json(options.run);
      }
      return Promise.resolve(new Response('{}', { status: 404 }));
    }),
  );
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const rootRoute = createRootRoute({
    component: () => (
      <RunnableExampleBlock id="sum" code={CODE} predict={false} {...options.props} />
    ),
  });
  const router = createRouter({
    routeTree: rootRoute,
    history: createMemoryHistory({ initialEntries: ['/'] }),
  });
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { runs };
}

const ok = (stdout: string, extra: Partial<Extract<GoRunResponse, { phase: 'run' }>['run']> = {}) =>
  ({
    phase: 'run',
    compileMs: 120,
    run: {
      reason: 'exit',
      stdout,
      stderr: '',
      exitCode: 0,
      durationMs: 50,
      virtualMs: 0,
      ...extra,
    },
  }) satisfies GoRunResponse;

describe('RunnableExampleBlock', () => {
  it('runs the code on the server and shows its output', async () => {
    const { runs } = setup({ run: ok('합계: 7\n') });
    const user = userEvent.setup();
    const run = await screen.findByRole('button', { name: /^실행/ });
    await vi.waitFor(() => {
      expect(run).toBeEnabled();
    });
    await user.click(run);
    expect(await screen.findByLabelText('표준 출력')).toHaveTextContent('합계: 7');
    expect(runs).toEqual([{ source: CODE, stdin: '' }]);
    expect(screen.getByRole('button', { name: /다시 실행/ })).toBeInTheDocument();
  });

  it('asks for a prediction first, unless skipped', async () => {
    setup({ run: ok('합계: 7\n'), props: { predict: true } });
    const user = userEvent.setup();
    const run = await screen.findByRole('button', { name: /^실행/ });
    await vi.waitFor(() => {
      expect(screen.getByLabelText('예상한 출력')).toBeInTheDocument();
    });
    expect(run).toBeDisabled();
    await user.type(screen.getByLabelText('예상한 출력'), '합계: 7');
    expect(run).toBeEnabled();
    await user.click(run);
    expect(await screen.findByText(/내 예측/)).toHaveTextContent('합계: 7');
  });

  it('shows compiler errors and says when an example is meant to fail', async () => {
    setup({
      props: { expectError: true },
      run: {
        phase: 'compile',
        compile: {
          reason: 'compile-error',
          output: './main.go:5:2: declared and not used: x',
          diagnostics: [
            { file: 'main.go', line: 5, column: 2, message: 'declared and not used: x' },
          ],
          durationMs: 80,
        },
      },
    });
    const user = userEvent.setup();
    const run = await screen.findByRole('button', { name: /^실행/ });
    await vi.waitFor(() => {
      expect(run).toBeEnabled();
    });
    await user.click(run);
    expect(await screen.findByLabelText('컴파일 오류')).toHaveTextContent(
      './main.go:5:2: declared and not used: x',
    );
    expect(screen.getByText(/컴파일 오류를 보여 주는 예제/)).toBeInTheDocument();
  });

  it('explains stopped runs and virtual time', async () => {
    setup({ run: ok('', { reason: 'timeout', exitCode: null, virtualMs: 2000 }) });
    const user = userEvent.setup();
    const run = await screen.findByRole('button', { name: /^실행/ });
    await vi.waitFor(() => {
      expect(run).toBeEnabled();
    });
    await user.click(run);
    expect(await screen.findByText(/5초 안에 끝나지 않아서 멈췄어요/)).toBeInTheDocument();
    expect(screen.getByText(/time.Sleep 같은 대기\(2초\)/)).toBeInTheDocument();
  });

  it('turns runs off and points to the settings without Go', async () => {
    setup({ toolchain: { ...READY, status: 'missing', version: null, goBin: null } });
    const note = await screen.findByRole('note');
    expect(note).toHaveTextContent('Go가 설치되어 있지 않아서');
    expect(within(note).getByRole('link', { name: 'Go 실행 환경 설정' })).toHaveAttribute(
      'href',
      '/settings/go',
    );
    expect(screen.getByRole('button', { name: /^실행/ })).toBeDisabled();
  });

  it('lets the learner edit and restore the code', async () => {
    setup({ run: ok(''), props: { editable: true } });
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: '코드 수정' }));
    expect(await screen.findByRole('textbox', { name: '예제 코드 편집 (Go)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'gofmt로 정리' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '원래 코드로' }));
    expect(screen.queryByRole('textbox', { name: '예제 코드 편집 (Go)' })).not.toBeInTheDocument();
  });
});

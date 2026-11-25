import { findGoToolchain, type GoToolchain } from '@proginone/go-runner';
import { Hono } from 'hono';
import { beforeAll, describe, expect, it } from 'vitest';
import { GoService } from '../../services/go/go-service.ts';
import { silentLog, tmpDir } from '../../test/helpers.ts';
import type { AppEnv } from '../env.ts';
import { handleError } from '../errors.ts';
import { goRoutes } from './go.ts';

const lookup = await findGoToolchain();
const toolchain: GoToolchain | null = lookup.status === 'ok' ? lookup.toolchain : null;
if (!toolchain && process.env['CI']) throw new Error('CI needs Go for the /go route tests');

function appFor(service: GoService) {
  const app = new Hono<AppEnv>().route('/go', goRoutes(service));
  app.onError((err, c) => handleError(err, c, silentLog));
  return app;
}

const post = (app: ReturnType<typeof appFor>, path: string, body: unknown) =>
  app.request(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

describe('/go without Go', () => {
  const service = new GoService({
    dataDir: tmpDir(),
    contentVersion: '1.27.3',
    log: silentLog,
    find: () => Promise.resolve({ status: 'missing', searched: ['/usr/local/go/bin/go'] }),
  });
  const app = appFor(service);
  beforeAll(() => service.refresh());

  it('reports where it looked', async () => {
    const res = await app.request('/go/toolchain');
    expect(await res.json()).toEqual({
      status: 'missing',
      version: null,
      goBin: null,
      minVersion: 'go1.22',
      contentVersion: 'go1.27.3',
      matchesContentVersion: null,
      searched: ['/usr/local/go/bin/go'],
    });
  });

  it('refuses runs and formatting with a reason the web app can branch on', async () => {
    for (const [path, body] of [
      ['/go/run', { source: 'package main' }],
      ['/go/format', { source: 'package main' }],
    ] as const) {
      const res = await post(app, path, body);
      expect(res.status).toBe(409);
      expect(await res.json()).toMatchObject({
        error: { code: 'EXERCISE_NOT_RUNNABLE', details: { reason: 'go-unavailable' } },
      });
    }
  });

  it('says which old Go it found', async () => {
    const old = new GoService({
      dataDir: tmpDir(),
      contentVersion: '1.27.3',
      log: silentLog,
      find: () =>
        Promise.resolve({
          status: 'too-old',
          goBin: '/old/go',
          version: { raw: 'go1.21.5', major: 1, minor: 21, patch: 5 },
        }),
    });
    await old.refresh();
    const res = await post(appFor(old), '/go/run', { source: 'package main' });
    expect(await res.json()).toMatchObject({
      error: { message: 'Go 1.22 이상이 필요해요. 지금 찾은 Go는 go1.21.5이에요.' },
    });
  });
});

describe.skipIf(!toolchain)('/go with Go', () => {
  const service = new GoService({ dataDir: tmpDir(), contentVersion: '1.27.3', log: silentLog });
  const app = appFor(service);
  beforeAll(() => service.start(), 180_000);

  it('reports the toolchain', async () => {
    const body = (await (await app.request('/go/toolchain')).json()) as Record<string, unknown>;
    expect(body).toMatchObject({ status: 'ok', version: toolchain?.version.raw, searched: [] });
  });

  it('runs a program with standard input', async () => {
    const source =
      'package main\n\nimport "fmt"\n\nfunc main() {\n\tvar s string\n\tfmt.Scanln(&s)\n\tfmt.Println("안녕", s)\n}\n';
    const res = await post(app, '/go/run', { source, stdin: '고퍼\n' });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { phase: string; run: Record<string, unknown> };
    expect(body.phase).toBe('run');
    expect(body.run).toMatchObject({ reason: 'exit', exitCode: 0, stdout: '안녕 고퍼\n' });
    expect(body.run).not.toHaveProperty('internalMessage');
  });

  it('returns compile errors with positions', async () => {
    const res = await post(app, '/go/run', {
      source: 'package main\n\nfunc main() {\n\tx := 1\n}\n',
    });
    expect(await res.json()).toMatchObject({
      phase: 'compile',
      compile: {
        reason: 'compile-error',
        diagnostics: [{ file: 'main.go', line: 4, column: 2, message: 'declared and not used: x' }],
      },
    });
  });

  it('formats with gofmt', async () => {
    const res = await post(app, '/go/format', { source: 'package main\nfunc main(){}\n' });
    expect(await res.json()).toEqual({ ok: true, source: 'package main\n\nfunc main() {}\n' });
  });

  it('validates bodies', async () => {
    expect((await post(app, '/go/run', { source: '' })).status).toBe(400);
    expect((await post(app, '/go/run', { source: 'x', extra: 1 })).status).toBe(400);
    expect((await post(app, '/go/run', { source: 'x'.repeat(70_000) })).status).toBe(400);
  });
});

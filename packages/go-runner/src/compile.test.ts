import { describe, expect, it } from 'vitest';

import { buildEnv, isValidSourceName, parseDiagnostics } from './compile.ts';
import type { GoToolchain } from './toolchain.ts';

const toolchain: GoToolchain = {
  goBin: '/go/bin/go',
  gofmtBin: '/go/bin/gofmt',
  goroot: '/go',
  version: { raw: 'go1.27.3', major: 1, minor: 27, patch: 3 },
};

describe('buildEnv', () => {
  it('passes nothing from the server environment', () => {
    process.env['GOFLAGS_PROBE'] = 'x';
    const env = buildEnv(toolchain, { cache: '/data/cache', work: '/data/work' }, 'darwin');
    delete process.env['GOFLAGS_PROBE'];
    expect(env).toMatchObject({
      GOOS: 'wasip1',
      GOARCH: 'wasm',
      CGO_ENABLED: '0',
      GOTOOLCHAIN: 'local',
      GOENV: 'off',
      GOWORK: 'off',
      GOPROXY: 'off',
      GOFLAGS: '-mod=mod',
      GOCACHE: '/data/cache',
    });
    expect(env).not.toHaveProperty('PATH');
    expect(env).not.toHaveProperty('GOFLAGS_PROBE');
  });
});

describe('isValidSourceName', () => {
  it('takes plain lower-case .go names only', () => {
    expect(isValidSourceName('main.go')).toBe(true);
    expect(isValidSourceName('harness_1.go')).toBe(true);
    for (const bad of ['../main.go', 'Main.go', 'main_test.go', 'main.txt', 'a/b.go', '.go']) {
      expect(isValidSourceName(bad), bad).toBe(false);
    }
  });
});

describe('parseDiagnostics', () => {
  it('reads file, line, column and message', () => {
    const output =
      './main.go:5:4: no new variables on left side of :=\nmain.go:2:8: "fmt" imported and not used\nnot a diagnostic';
    expect(parseDiagnostics(output)).toEqual([
      { file: 'main.go', line: 5, column: 4, message: 'no new variables on left side of :=' },
      { file: 'main.go', line: 2, column: 8, message: '"fmt" imported and not used' },
    ]);
  });
});

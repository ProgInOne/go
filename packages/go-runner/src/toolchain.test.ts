import { chmod, mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { findGoToolchain, isSupportedGoVersion, parseGoVersion } from './toolchain.ts';

describe('parseGoVersion', () => {
  it('reads release, minor-only and pre-release versions', () => {
    expect(parseGoVersion('go1.27.3')).toEqual({ raw: 'go1.27.3', major: 1, minor: 27, patch: 3 });
    expect(parseGoVersion('go1.22\n')).toMatchObject({ minor: 22, patch: 0 });
    expect(parseGoVersion('go1.23rc1')).toMatchObject({ minor: 23 });
    expect(parseGoVersion('devel go1.28-abc')).toBeNull();
  });

  it('needs Go 1.22 or newer', () => {
    const v = (raw: string) => {
      const parsed = parseGoVersion(raw);
      if (!parsed) throw new Error(raw);
      return parsed;
    };
    expect(isSupportedGoVersion(v('go1.21.13'))).toBe(false);
    expect(isSupportedGoVersion(v('go1.22.0'))).toBe(true);
    expect(isSupportedGoVersion(v('go1.27.3'))).toBe(true);
  });
});

describe.skipIf(process.platform === 'win32')('findGoToolchain', () => {
  /** A fake `go` that answers `go env GOVERSION GOROOT`. */
  async function fakeGo(version: string): Promise<string> {
    const root = await mkdtemp(join(tmpdir(), 'fake-go-'));
    const bin = join(root, 'bin');
    await mkdir(bin);
    await writeFile(join(bin, 'go'), `#!/bin/sh\necho ${version}\necho ${root}\n`);
    await writeFile(join(bin, 'gofmt'), '#!/bin/sh\ncat\n');
    await chmod(join(bin, 'go'), 0o755);
    await chmod(join(bin, 'gofmt'), 0o755);
    return bin;
  }

  it('prefers the configured path over PATH', async () => {
    const configured = await fakeGo('go1.24.1');
    const onPath = await fakeGo('go1.27.3');
    const found = await findGoToolchain({
      configuredPath: configured,
      pathEnv: onPath,
      standardDirs: [],
    });
    expect(found).toMatchObject({
      status: 'ok',
      toolchain: { goBin: join(configured, 'go'), version: { minor: 24 } },
    });
  });

  it('reports a too-old Go instead of skipping it', async () => {
    const old = await fakeGo('go1.21.0');
    expect(await findGoToolchain({ pathEnv: old, standardDirs: [] })).toMatchObject({
      status: 'too-old',
      version: { minor: 21 },
    });
  });

  it('lists where it looked when there is no Go', async () => {
    const empty = await mkdtemp(join(tmpdir(), 'no-go-'));
    const found = await findGoToolchain({ pathEnv: empty, standardDirs: [] });
    expect(found).toEqual({ status: 'missing', searched: [join(empty, 'go')] });
  });
});

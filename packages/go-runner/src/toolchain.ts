import { execFile } from 'node:child_process';
import { constants } from 'node:fs';
import { access, stat } from 'node:fs/promises';
import { delimiter, join } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

/** Oldest Go that runs our code the same way: 1.22 made `for` variables per-iteration (G-002). */
export const MIN_GO_VERSION = { major: 1, minor: 22 } as const;

export interface GoVersion {
  /** As `go env GOVERSION` prints it, e.g. `go1.27.3`. */
  raw: string;
  major: number;
  minor: number;
  patch: number;
}

export interface GoToolchain {
  goBin: string;
  gofmtBin: string;
  goroot: string;
  version: GoVersion;
}

export type ToolchainLookup =
  | { status: 'ok'; toolchain: GoToolchain }
  | { status: 'missing'; searched: string[] }
  | { status: 'too-old'; goBin: string; version: GoVersion }
  | { status: 'broken'; goBin: string; message: string };

/** Parses `go1.27.3`, `go1.22`, `go1.23rc1`; null for `devel …` and anything else. */
export function parseGoVersion(raw: string): GoVersion | null {
  const m = /^go(\d+)\.(\d+)(?:\.(\d+))?(?:(?:rc|beta)\d+)?$/.exec(raw.trim());
  if (!m) return null;
  return {
    raw: raw.trim(),
    major: Number(m[1]),
    minor: Number(m[2]),
    patch: m[3] === undefined ? 0 : Number(m[3]),
  };
}

export function isSupportedGoVersion(v: GoVersion): boolean {
  return (
    v.major > MIN_GO_VERSION.major ||
    (v.major === MIN_GO_VERSION.major && v.minor >= MIN_GO_VERSION.minor)
  );
}

/** Standard install folders per OS, after the configured path and `PATH`. */
export function standardGoDirs(platform: NodeJS.Platform): string[] {
  switch (platform) {
    case 'darwin':
      return ['/usr/local/go/bin', '/opt/homebrew/bin', '/usr/local/bin'];
    case 'win32':
      return ['C:\\Program Files\\Go\\bin'];
    default:
      return ['/usr/local/go/bin', '/usr/bin', '/snap/bin'];
  }
}

export interface FindToolchainOptions {
  /** A `go` binary or the folder holding it, from settings. Tried first. */
  configuredPath?: string;
  /** `PATH` to search; defaults to `process.env.PATH`. */
  pathEnv?: string;
  platform?: NodeJS.Platform;
  /** Extra folders after the standard ones (tests). */
  extraDirs?: string[];
  /** Replaces the standard folders (tests). */
  standardDirs?: string[];
}

async function isExecutableFile(path: string): Promise<boolean> {
  try {
    const s = await stat(path);
    if (!s.isFile()) return false;
    await access(path, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Finds the learner's Go (G-002): the configured path, then `PATH`, then the OS's standard
 * folders. The first `go` found decides; a too-old one is reported, not skipped, so the learner
 * sees which Go the app is looking at.
 */
export async function findGoToolchain(
  options: FindToolchainOptions = {},
): Promise<ToolchainLookup> {
  const platform = options.platform ?? process.platform;
  const exe = platform === 'win32' ? 'go.exe' : 'go';
  const pathEnv = options.pathEnv ?? process.env['PATH'] ?? '';
  const dirs = [
    ...pathEnv.split(platform === 'win32' ? ';' : delimiter).filter((d) => d !== ''),
    ...(options.standardDirs ?? standardGoDirs(platform)),
    ...(options.extraDirs ?? []),
  ];
  const candidates: string[] = [];
  if (options.configuredPath) {
    const p = options.configuredPath;
    candidates.push(p.endsWith(exe) ? p : join(p, exe));
  }
  for (const d of dirs) candidates.push(join(d, exe));

  const searched: string[] = [];
  for (const goBin of [...new Set(candidates)]) {
    searched.push(goBin);
    if (await isExecutableFile(goBin)) return inspectGo(goBin, platform);
  }
  return { status: 'missing', searched };
}

/** Asks a `go` binary for its version and GOROOT, without the user's Go settings. */
export async function inspectGo(
  goBin: string,
  platform: NodeJS.Platform = process.platform,
): Promise<ToolchainLookup> {
  let stdout: string;
  try {
    ({ stdout } = await execFileAsync(goBin, ['env', 'GOVERSION', 'GOROOT'], {
      timeout: 10_000,
      env: inspectEnv(platform),
      windowsHide: true,
    }));
  } catch (error) {
    return {
      status: 'broken',
      goBin,
      message: error instanceof Error ? error.message : String(error),
    };
  }
  const [rawVersion = '', goroot = ''] = stdout.split(/\r?\n/);
  const version = parseGoVersion(rawVersion);
  if (!version || goroot === '') {
    return {
      status: 'broken',
      goBin,
      message: `unexpected go env output: ${stdout.slice(0, 200)}`,
    };
  }
  if (!isSupportedGoVersion(version)) return { status: 'too-old', goBin, version };
  const gofmtBin = join(goroot, 'bin', platform === 'win32' ? 'gofmt.exe' : 'gofmt');
  if (!(await isExecutableFile(gofmtBin))) {
    return { status: 'broken', goBin, message: `gofmt not found at ${gofmtBin}` };
  }
  return { status: 'ok', toolchain: { goBin, gofmtBin, goroot, version } };
}

/** Enough environment for `go env` to answer without reading the user's `go env -w` file. */
function inspectEnv(platform: NodeJS.Platform): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    GOENV: 'off',
    GOTOOLCHAIN: 'local',
    GOFLAGS: '',
    GOTELEMETRY: 'off',
  };
  if (platform === 'win32') {
    for (const key of ['SystemRoot', 'USERPROFILE', 'LOCALAPPDATA', 'TEMP', 'TMP']) {
      const v = process.env[key];
      if (v !== undefined) env[key] = v;
    }
  } else {
    const home = process.env['HOME'];
    if (home !== undefined) env['HOME'] = home;
  }
  return env;
}

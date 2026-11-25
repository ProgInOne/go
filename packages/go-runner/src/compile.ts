import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { GoToolchain } from './toolchain.ts';

/** Folders under the app data folder that compiling uses (G-002). */
export interface GoWorkDirs {
  /** `GOCACHE`: kept between runs so a rebuild takes ~0.3 s. Not backed up. */
  cache: string;
  /** Parent of the per-run temporary modules, and the `HOME`/`TMPDIR`/`GOPATH` Go sees. */
  work: string;
}

export interface SourceFile {
  /** A plain `.go` file name chosen by the server, e.g. `main.go`. */
  name: string;
  content: string;
}

export interface Diagnostic {
  file: string;
  line: number;
  column: number;
  message: string;
}

export type CompileResult =
  | { ok: true; wasm: Uint8Array; durationMs: number }
  | {
      ok: false;
      reason: 'compile-error';
      /** The compiler's text as printed, without the `# prog` package header. */
      output: string;
      diagnostics: Diagnostic[];
      durationMs: number;
    }
  | {
      ok: false;
      reason: 'timeout' | 'output-limit' | 'internal';
      message: string;
      durationMs: number;
    };

export interface CompileOptions {
  toolchain: GoToolchain;
  dirs: GoWorkDirs;
  files: SourceFile[];
  timeoutMs?: number;
  outputLimitBytes?: number;
}

export const COMPILE_DEFAULTS = { timeoutMs: 30_000, outputLimitBytes: 64 * 1024 } as const;

/** Module name of every temporary module; the compiler prints it as `# prog`. */
const MODULE = 'prog';
/** Language version of the temporary module: semantics stay 1.22 on newer Go (G-002). */
const GO_MOD = `module ${MODULE}\n\ngo 1.22\n`;
const FILE_NAME = /^[a-z][a-z0-9_]*\.go$/;

export function isValidSourceName(name: string): boolean {
  return FILE_NAME.test(name) && !name.endsWith('_test.go') && name.length <= 64;
}

/**
 * The whole environment `go build` gets. Nothing is inherited from the server process, so the
 * user's `GOFLAGS` (e.g. `-toolexec`), `go env -w` file, `go.work`, proxy and toolchain switching
 * cannot reach the build (G-002).
 */
export function buildEnv(
  toolchain: GoToolchain,
  dirs: GoWorkDirs,
  platform = process.platform,
): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    GOOS: 'wasip1',
    GOARCH: 'wasm',
    CGO_ENABLED: '0',
    GOROOT: toolchain.goroot,
    GOTOOLCHAIN: 'local',
    GOENV: 'off',
    GOWORK: 'off',
    GOPROXY: 'off',
    GOSUMDB: 'off',
    GOFLAGS: '-mod=mod',
    GOTELEMETRY: 'off',
    GOCACHE: dirs.cache,
    GOPATH: join(dirs.work, 'gopath'),
    GOMODCACHE: join(dirs.work, 'gopath', 'pkg', 'mod'),
    HOME: join(dirs.work, 'home'),
    TMPDIR: join(dirs.work, 'tmp'),
  };
  if (platform === 'win32') {
    // Windows processes need SystemRoot to start; Go reads the temp folder from TMP/TEMP.
    const systemRoot = process.env['SystemRoot'];
    if (systemRoot !== undefined) env['SystemRoot'] = systemRoot;
    env['TMP'] = env['TMPDIR'];
    env['TEMP'] = env['TMPDIR'];
    env['USERPROFILE'] = env['HOME'];
    env['LOCALAPPDATA'] = join(dirs.work, 'home');
  }
  return env;
}

const DIAGNOSTIC = /^(?:\.[/\\])?([A-Za-z0-9_]+\.go):(\d+):(\d+): (.*)$/;

/** Pulls `file:line:col: message` lines out of compiler output. */
export function parseDiagnostics(output: string): Diagnostic[] {
  const out: Diagnostic[] = [];
  for (const line of output.split(/\r?\n/)) {
    const m = DIAGNOSTIC.exec(line);
    if (m?.[1] === undefined || m[4] === undefined) continue;
    out.push({ file: m[1], line: Number(m[2]), column: Number(m[3]), message: m[4] });
  }
  return out;
}

function cleanOutput(output: string): string {
  return output
    .split(/\r?\n/)
    .filter((l) => l !== `# ${MODULE}`)
    .join('\n')
    .trimEnd();
}

/**
 * Builds the files as one `main` package into a `wasip1` Wasm module, in a fresh temporary
 * module under `dirs.work` that holds only these files (so `//go:embed` has nothing else to
 * reach), with a clean environment and a time limit.
 */
export async function compileGo(options: CompileOptions): Promise<CompileResult> {
  const started = performance.now();
  const elapsed = () => Math.round(performance.now() - started);
  const timeoutMs = options.timeoutMs ?? COMPILE_DEFAULTS.timeoutMs;
  const outputLimit = options.outputLimitBytes ?? COMPILE_DEFAULTS.outputLimitBytes;

  if (options.files.length === 0) {
    return { ok: false, reason: 'internal', message: 'no source files', durationMs: 0 };
  }
  const names = new Set<string>();
  for (const f of options.files) {
    if (!isValidSourceName(f.name) || names.has(f.name)) {
      return {
        ok: false,
        reason: 'internal',
        message: `bad source file name: ${f.name}`,
        durationMs: 0,
      };
    }
    names.add(f.name);
  }

  const env = buildEnv(options.toolchain, options.dirs);
  const needed = [options.dirs.cache, env['HOME'], env['TMPDIR'], env['GOPATH']];
  await Promise.all(
    needed.filter((d) => d !== undefined).map((d) => mkdir(d, { recursive: true })),
  );
  const runs = join(options.dirs.work, 'runs');
  await mkdir(runs, { recursive: true });
  const dir = await mkdtemp(join(runs, 'build-'));
  try {
    await writeFile(join(dir, 'go.mod'), GO_MOD);
    for (const f of options.files) await writeFile(join(dir, f.name), f.content);

    const outcome = await spawnLimited(
      options.toolchain.goBin,
      ['build', '-trimpath', '-o', 'out.wasm', '.'],
      { cwd: dir, env, timeoutMs, outputLimit },
    );
    if (outcome.kind === 'timeout') {
      return {
        ok: false,
        reason: 'timeout',
        message: `compile took over ${timeoutMs} ms`,
        durationMs: elapsed(),
      };
    }
    if (outcome.kind === 'output-limit') {
      return {
        ok: false,
        reason: 'output-limit',
        message: 'compiler output too long',
        durationMs: elapsed(),
      };
    }
    if (outcome.kind === 'error') {
      return { ok: false, reason: 'internal', message: outcome.message, durationMs: elapsed() };
    }
    if (outcome.code !== 0) {
      const output = cleanOutput(outcome.output);
      return {
        ok: false,
        reason: 'compile-error',
        output,
        diagnostics: parseDiagnostics(output),
        durationMs: elapsed(),
      };
    }
    const wasm = new Uint8Array(await readFile(join(dir, 'out.wasm')));
    return { ok: true, wasm, durationMs: elapsed() };
  } finally {
    await rm(dir, { recursive: true, force: true, maxRetries: 3 });
  }
}

export type SpawnOutcome =
  | { kind: 'exit'; code: number; output: string; stdout: string }
  | { kind: 'timeout' }
  | { kind: 'output-limit' }
  | { kind: 'error'; message: string };

/**
 * Runs a tool with a time and output limit. On POSIX the child gets its own process group so a
 * timeout also stops the compiler processes `go` started.
 */
export function spawnLimited(
  command: string,
  args: string[],
  options: {
    cwd: string;
    env: NodeJS.ProcessEnv;
    timeoutMs: number;
    outputLimit: number;
    stdin?: string;
  },
): Promise<SpawnOutcome> {
  return new Promise((resolve) => {
    const posix = process.platform !== 'win32';
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env,
      detached: posix,
      windowsHide: true,
      stdio: [options.stdin === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe'],
    });
    const out: Buffer[] = [];
    const all: Buffer[] = [];
    let size = 0;
    let settled = false;
    const finish = (outcome: SpawnOutcome) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(outcome);
    };
    const kill = () => {
      try {
        if (posix && child.pid !== undefined) process.kill(-child.pid, 'SIGKILL');
        else child.kill('SIGKILL');
      } catch {
        // Already gone.
      }
    };
    const timer = setTimeout(() => {
      kill();
      finish({ kind: 'timeout' });
    }, options.timeoutMs);
    const collect = (isStdout: boolean) => (chunk: Buffer) => {
      size += chunk.length;
      if (size > options.outputLimit) {
        kill();
        finish({ kind: 'output-limit' });
        return;
      }
      all.push(chunk);
      if (isStdout) out.push(chunk);
    };
    child.stdout?.on('data', collect(true));
    child.stderr?.on('data', collect(false));
    child.on('error', (error) => {
      finish({ kind: 'error', message: error.message });
    });
    child.on('close', (code) => {
      finish({
        kind: 'exit',
        code: code ?? -1,
        output: Buffer.concat(all).toString('utf8'),
        stdout: Buffer.concat(out).toString('utf8'),
      });
    });
    if (options.stdin !== undefined && child.stdin) {
      child.stdin.on('error', () => {
        // The child exited before reading everything; its exit code tells the story.
      });
      child.stdin.end(options.stdin);
    }
  });
}

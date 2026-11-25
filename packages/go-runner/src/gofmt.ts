import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

import { parseDiagnostics, spawnLimited, type Diagnostic } from './compile.ts';
import type { GoToolchain } from './toolchain.ts';

export type FormatResult =
  | { ok: true; source: string }
  | { ok: false; reason: 'syntax-error'; output: string; diagnostics: Diagnostic[] }
  | { ok: false; reason: 'timeout' | 'too-large' | 'internal'; message: string };

export const FORMAT_DEFAULTS = { timeoutMs: 2_000, maxBytes: 256 * 1024 } as const;

/**
 * Formats Go source with the learner's `gofmt`, reading standard input so nothing is written to
 * disk. On a syntax error the source is left alone and the error is returned (G-002).
 */
export async function formatGo(options: {
  toolchain: GoToolchain;
  workDir: string;
  source: string;
  timeoutMs?: number;
}): Promise<FormatResult> {
  if (Buffer.byteLength(options.source) > FORMAT_DEFAULTS.maxBytes) {
    return { ok: false, reason: 'too-large', message: 'source too large to format' };
  }
  await mkdir(options.workDir, { recursive: true });
  const outcome = await spawnLimited(options.toolchain.gofmtBin, [], {
    cwd: options.workDir,
    env: process.platform === 'win32' ? { SystemRoot: process.env['SystemRoot'] } : {},
    timeoutMs: options.timeoutMs ?? FORMAT_DEFAULTS.timeoutMs,
    outputLimit: FORMAT_DEFAULTS.maxBytes * 4,
    stdin: options.source,
  });
  if (outcome.kind === 'timeout')
    return { ok: false, reason: 'timeout', message: 'gofmt timed out' };
  if (outcome.kind === 'output-limit')
    return { ok: false, reason: 'too-large', message: 'gofmt output too large' };
  if (outcome.kind === 'error') return { ok: false, reason: 'internal', message: outcome.message };
  if (outcome.code !== 0) {
    // gofmt names standard input `<standard input>`; show it as the learner's file.
    const output = outcome.output.replaceAll('<standard input>', 'main.go').trimEnd();
    return { ok: false, reason: 'syntax-error', output, diagnostics: parseDiagnostics(output) };
  }
  return { ok: true, source: outcome.stdout };
}

/** Where a runner keeps its files under the app data folder. */
export function goRunnerDataDir(appDataDir: string): string {
  return join(appDataDir, 'go-runner');
}

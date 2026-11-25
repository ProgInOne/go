import { Worker } from 'node:worker_threads';

import { limitWasmMemory } from './wasm-memory.ts';
import type { WorkerInput, WorkerMessage } from './worker-protocol.ts';

export type RunReason =
  /** The program returned from `main` or called `os.Exit`. */
  | 'exit'
  /** A `panic` (exit code 2 with a `panic:` report). */
  | 'panic'
  /** The Go runtime stopped with `fatal error:` (e.g. every goroutine asleep). */
  | 'fatal'
  /** Wasm memory reached the limit. */
  | 'memory'
  | 'timeout'
  | 'output-limit'
  /** The module could not load or trapped outside Go's own error handling. */
  | 'crash';

export interface RunResult {
  reason: RunReason;
  stdout: string;
  stderr: string;
  /** Null when the run was stopped (timeout, output limit, crash). */
  exitCode: number | null;
  durationMs: number;
  /** How far the virtual clock moved (sleeps), in milliseconds. */
  virtualMs: number;
  /** Set for `crash`: what went wrong, for logs, not for learners. */
  internalMessage?: string;
}

export interface RunOptions {
  wasm: Uint8Array;
  stdin?: string;
  timeoutMs?: number;
  memoryLimitBytes?: number;
  outputLimitBytes?: number;
  /** Same seed, same `math/rand` sequence. Grading and content checks pass a fixed one. */
  randomSeed?: number;
}

export const RUN_DEFAULTS = {
  timeoutMs: 5_000,
  memoryLimitBytes: 256 * 1024 * 1024,
  outputLimitBytes: 64 * 1024,
} as const;

const WORKER_URL = new URL('./worker.ts', import.meta.url);

/** Classifies a finished program from its exit code and standard error. */
export function classifyExit(exitCode: number, stderr: string): RunReason {
  if (exitCode !== 2) return 'exit';
  if (stderr.includes('out of memory')) return 'memory';
  if (/^panic: /m.test(stderr)) return 'panic';
  if (/^fatal error: /m.test(stderr)) return 'fatal';
  return 'exit';
}

/**
 * Runs a `wasip1` module in a fresh worker thread with the minimal WASI and the time, memory
 * and output limits (G-002).
 */
export function runWasm(options: RunOptions): Promise<RunResult> {
  const timeoutMs = options.timeoutMs ?? RUN_DEFAULTS.timeoutMs;
  const outputLimitBytes = options.outputLimitBytes ?? RUN_DEFAULTS.outputLimitBytes;
  const started = performance.now();
  const elapsed = () => Math.round(performance.now() - started);
  const stdout: Uint8Array[] = [];
  const stderr: Uint8Array[] = [];
  const text = (chunks: Uint8Array[]) => Buffer.concat(chunks).toString('utf8');

  let wasm: Uint8Array;
  try {
    wasm = limitWasmMemory(options.wasm, options.memoryLimitBytes ?? RUN_DEFAULTS.memoryLimitBytes);
  } catch (error) {
    return Promise.resolve({
      reason: 'crash',
      stdout: '',
      stderr: '',
      exitCode: null,
      durationMs: 0,
      virtualMs: 0,
      internalMessage: error instanceof Error ? error.message : String(error),
    });
  }

  const input: WorkerInput = {
    wasm,
    stdin: new TextEncoder().encode(options.stdin ?? ''),
    outputLimitBytes,
    randomSeed: options.randomSeed ?? 1,
  };

  return new Promise((resolve) => {
    const worker = new Worker(WORKER_URL, {
      workerData: input,
      transferList: [wasm.buffer as ArrayBuffer],
      // JS heap of the worker itself; Wasm memory is capped by limitWasmMemory.
      resourceLimits: { maxOldGenerationSizeMb: 64, maxYoungGenerationSizeMb: 16 },
      stdout: true,
      stderr: true,
    });
    let settled = false;
    const finish = (result: Omit<RunResult, 'stdout' | 'stderr' | 'durationMs'>) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      void worker.terminate();
      resolve({ ...result, stdout: text(stdout), stderr: text(stderr), durationMs: elapsed() });
    };
    const timer = setTimeout(() => {
      finish({ reason: 'timeout', exitCode: null, virtualMs: 0 });
    }, timeoutMs);

    worker.on('message', (message: WorkerMessage) => {
      if (message.type === 'output') {
        (message.fd === 1 ? stdout : stderr).push(message.bytes);
        return;
      }
      const virtualMs = Number((message.virtualNs ?? 0n) / 1_000_000n);
      if (message.outcome === 'exit') {
        const exitCode = message.exitCode ?? 0;
        finish({ reason: classifyExit(exitCode, text(stderr)), exitCode, virtualMs });
      } else if (message.outcome === 'output-limit') {
        finish({ reason: 'output-limit', exitCode: null, virtualMs });
      } else {
        finish({
          reason: 'crash',
          exitCode: null,
          virtualMs,
          ...(message.message === undefined ? {} : { internalMessage: message.message }),
        });
      }
    });
    worker.on('error', (error: Error) => {
      finish({ reason: 'crash', exitCode: null, virtualMs: 0, internalMessage: error.message });
    });
    worker.on('exit', (code) => {
      finish({
        reason: 'crash',
        exitCode: null,
        virtualMs: 0,
        internalMessage: `worker exited (${code})`,
      });
    });
  });
}

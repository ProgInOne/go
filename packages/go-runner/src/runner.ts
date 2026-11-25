import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

import { compileGo, type CompileResult, type GoWorkDirs, type SourceFile } from './compile.ts';
import { formatGo, type FormatResult } from './gofmt.ts';
import { runWasm, type RunOptions, type RunResult } from './run.ts';
import type { GoToolchain } from './toolchain.ts';

export type GoRunResult =
  | { phase: 'compile'; compile: Exclude<CompileResult, { ok: true }> }
  | { phase: 'run'; compileMs: number; run: RunResult };

export interface GoRunRequest {
  files: SourceFile[];
  stdin?: string;
  randomSeed?: number;
  limits?: Pick<RunOptions, 'timeoutMs' | 'memoryLimitBytes' | 'outputLimitBytes'> & {
    compileTimeoutMs?: number;
  };
}

export interface GoRunner {
  readonly toolchain: GoToolchain;
  run(request: GoRunRequest): Promise<GoRunResult>;
  format(source: string): Promise<FormatResult>;
  /** Compiles an empty program once so the first learner run does not pay for the cold cache. */
  prewarm(): Promise<void>;
}

export interface CreateGoRunnerOptions {
  toolchain: GoToolchain;
  /** A folder under the app data folder; the runner keeps its build cache and temp files here. */
  dataDir: string;
  /** Runs at the same time across the server (G-002); the rest wait their turn. */
  maxConcurrent?: number;
}

class Semaphore {
  private active = 0;
  private readonly waiting: (() => void)[] = [];
  private readonly limit: number;
  constructor(limit: number) {
    this.limit = limit;
  }

  async use<T>(task: () => Promise<T>): Promise<T> {
    if (this.active >= this.limit) {
      await new Promise<void>((resolve) => this.waiting.push(resolve));
    }
    this.active += 1;
    try {
      return await task();
    } finally {
      this.active -= 1;
      this.waiting.shift()?.();
    }
  }
}

export function createGoRunner(options: CreateGoRunnerOptions): GoRunner {
  const dirs: GoWorkDirs = {
    cache: join(options.dataDir, 'go-build'),
    work: join(options.dataDir, 'work'),
  };
  const gate = new Semaphore(options.maxConcurrent ?? 2);
  const { toolchain } = options;

  const run = (request: GoRunRequest) =>
    gate.use(async (): Promise<GoRunResult> => {
      const compile = await compileGo({
        toolchain,
        dirs,
        files: request.files,
        ...(request.limits?.compileTimeoutMs === undefined
          ? {}
          : { timeoutMs: request.limits.compileTimeoutMs }),
      });
      if (!compile.ok) return { phase: 'compile', compile };
      const result = await runWasm({
        wasm: compile.wasm,
        ...(request.stdin === undefined ? {} : { stdin: request.stdin }),
        ...(request.randomSeed === undefined ? {} : { randomSeed: request.randomSeed }),
        ...request.limits,
      });
      return { phase: 'run', compileMs: compile.durationMs, run: result };
    });

  return {
    toolchain,
    run,
    format: (source) => formatGo({ toolchain, workDir: dirs.work, source }),
    async prewarm() {
      await mkdir(dirs.work, { recursive: true });
      await run({
        files: [
          {
            name: 'main.go',
            content: 'package main\n\nimport "fmt"\n\nfunc main() { fmt.Print("") }\n',
          },
        ],
      });
    },
  };
}

/** Messages between `run.ts` and `worker.ts`. */

export interface WorkerInput {
  wasm: Uint8Array;
  stdin: Uint8Array;
  outputLimitBytes: number;
  randomSeed: number;
}

export type WorkerMessage =
  | { type: 'output'; fd: 1 | 2; bytes: Uint8Array }
  | {
      type: 'done';
      outcome: 'exit' | 'output-limit' | 'crash';
      exitCode?: number;
      message?: string;
      virtualNs?: bigint;
    };

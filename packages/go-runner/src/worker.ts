/**
 * Worker thread entry: instantiates one learner module against the minimal WASI and runs
 * `_start` (G-002). Output goes to the parent as it is written, so a run stopped for time still
 * shows what it printed. The parent enforces the wall-clock limit with `Worker.terminate()`.
 */
import type {} from './webassembly.d.ts';
import { parentPort, workerData } from 'node:worker_threads';

import { MinimalWasi, OutputLimitExceeded, WASI_MODULE, WasiExit } from './wasi.ts';
import type { WorkerInput, WorkerMessage } from './worker-protocol.ts';

const port = parentPort;
if (!port) throw new Error('worker.ts must run in a worker thread');
const input = workerData as WorkerInput;
const send = (message: WorkerMessage) => {
  port.postMessage(message);
};

function run(): WorkerMessage {
  let module: WebAssembly.Module;
  try {
    module = new WebAssembly.Module(input.wasm);
  } catch (error) {
    return { type: 'done', outcome: 'crash', message: `invalid module: ${String(error)}` };
  }
  const imports = WebAssembly.Module.imports(module);
  const foreign = imports.find((i) => i.module !== WASI_MODULE || i.kind !== 'function');
  if (foreign) {
    return {
      type: 'done',
      outcome: 'crash',
      message: `unsupported import ${foreign.module}.${foreign.name}`,
    };
  }
  const wasi = new MinimalWasi({
    stdin: input.stdin,
    outputLimitBytes: input.outputLimitBytes,
    randomSeed: input.randomSeed,
    onOutput: (fd, bytes) => {
      send({ type: 'output', fd, bytes });
    },
  });
  let instance: WebAssembly.Instance;
  try {
    instance = new WebAssembly.Instance(module, {
      [WASI_MODULE]: wasi.imports(imports.map((i) => i.name)),
    });
  } catch (error) {
    return { type: 'done', outcome: 'crash', message: `instantiate failed: ${String(error)}` };
  }
  const { memory, _start: start } = instance.exports;
  if (!(memory instanceof WebAssembly.Memory) || typeof start !== 'function') {
    return { type: 'done', outcome: 'crash', message: 'module lacks memory or _start' };
  }
  wasi.bind(memory);
  try {
    (start as () => void)();
    return { type: 'done', outcome: 'exit', exitCode: 0, virtualNs: wasi.elapsedNs };
  } catch (error) {
    if (error instanceof WasiExit) {
      return { type: 'done', outcome: 'exit', exitCode: error.code, virtualNs: wasi.elapsedNs };
    }
    if (error instanceof OutputLimitExceeded) {
      return { type: 'done', outcome: 'output-limit', virtualNs: wasi.elapsedNs };
    }
    return { type: 'done', outcome: 'crash', message: String(error), virtualNs: wasi.elapsedNs };
  }
}

send(run());

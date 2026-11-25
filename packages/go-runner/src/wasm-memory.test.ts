import type {} from './webassembly.d.ts';
import { describe, expect, it } from 'vitest';

import { limitWasmMemory, WASM_PAGE_BYTES } from './wasm-memory.ts';

const HEADER = [0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00];
/** Export section: `memory` → memory 0. */
const EXPORT_MEMORY = [0x07, 0x0a, 0x01, 0x06, ...new TextEncoder().encode('memory'), 0x02, 0x00];

/** `(module (memory (export "memory") <min> <max?>))` */
function moduleWithMemory(min: number, max?: number): Uint8Array {
  const limits = max === undefined ? [0x00, min] : [0x01, min, max];
  return new Uint8Array([...HEADER, 0x05, limits.length + 1, 0x01, ...limits, ...EXPORT_MEMORY]);
}

function memoryOf(bytes: Uint8Array): WebAssembly.Memory {
  const { memory } = new WebAssembly.Instance(new WebAssembly.Module(bytes)).exports;
  if (!(memory instanceof WebAssembly.Memory)) throw new Error('no memory');
  return memory;
}

describe('limitWasmMemory', () => {
  it('caps a memory that had no maximum', () => {
    const memory = memoryOf(limitWasmMemory(moduleWithMemory(1), 3 * WASM_PAGE_BYTES));
    expect(memory.grow(2)).toBe(1);
    expect(() => memory.grow(1)).toThrow(RangeError);
  });

  it('keeps a smaller declared maximum', () => {
    const memory = memoryOf(limitWasmMemory(moduleWithMemory(1, 2), 10 * WASM_PAGE_BYTES));
    expect(memory.grow(1)).toBe(1);
    expect(() => memory.grow(1)).toThrow(RangeError);
  });

  it('refuses modules it cannot limit', () => {
    expect(() => limitWasmMemory(new Uint8Array([1, 2, 3]), WASM_PAGE_BYTES)).toThrow(
      'not a wasm module',
    );
    expect(() => limitWasmMemory(new Uint8Array([...HEADER]), WASM_PAGE_BYTES)).toThrow(
      'defines no memory',
    );
    expect(() => limitWasmMemory(moduleWithMemory(5), 2 * WASM_PAGE_BYTES)).toThrow(
      'more memory than the limit',
    );
  });
});

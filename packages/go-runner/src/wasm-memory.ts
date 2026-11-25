/** Wasm page size: memory limits count 64 KiB pages. */
export const WASM_PAGE_BYTES = 65_536;

function readU32(bytes: Uint8Array, offset: number): { value: number; next: number } {
  let result = 0;
  let shift = 0;
  let pos = offset;
  for (;;) {
    const byte = bytes[pos];
    if (byte === undefined) throw new Error('truncated LEB128');
    pos += 1;
    result += (byte & 0x7f) * 2 ** shift;
    if ((byte & 0x80) === 0) break;
    shift += 7;
    if (shift > 28) throw new Error('LEB128 too long for u32');
  }
  return { value: result, next: pos };
}

function writeU32(value: number): number[] {
  const out: number[] = [];
  let v = value;
  do {
    let byte = v & 0x7f;
    v = Math.floor(v / 128);
    if (v !== 0) byte |= 0x80;
    out.push(byte);
  } while (v !== 0);
  return out;
}

const MEMORY_SECTION = 5;

/**
 * Returns a copy of the module whose own memory may grow to at most `maxBytes` (G-002). Go
 * defines its memory without a maximum; with one, a `memory.grow` past it fails and the Go
 * runtime stops with "out of memory" instead of taking the machine's RAM. Modules that import
 * their memory, define none, or use 64-bit or shared memory are refused: Go does none of these.
 */
export function limitWasmMemory(wasm: Uint8Array, maxBytes: number): Uint8Array {
  const maxPages = Math.floor(maxBytes / WASM_PAGE_BYTES);
  if (maxPages < 1) throw new Error('memory limit below one page');
  if (
    wasm.length < 8 ||
    wasm[0] !== 0x00 ||
    wasm[1] !== 0x61 ||
    wasm[2] !== 0x73 ||
    wasm[3] !== 0x6d
  ) {
    throw new Error('not a wasm module');
  }
  let pos = 8;
  while (pos < wasm.length) {
    const id = wasm[pos];
    const size = readU32(wasm, pos + 1);
    const bodyStart = size.next;
    const bodyEnd = bodyStart + size.value;
    if (bodyEnd > wasm.length) throw new Error('truncated section');
    if (id === MEMORY_SECTION) {
      const count = readU32(wasm, bodyStart);
      if (count.value !== 1) throw new Error(`expected one memory, found ${count.value}`);
      const flags = wasm[count.next];
      if (flags !== 0x00 && flags !== 0x01) throw new Error(`unsupported memory flags ${flags}`);
      const min = readU32(wasm, count.next + 1);
      let end = min.next;
      let max = maxPages;
      if (flags === 0x01) {
        const declared = readU32(wasm, min.next);
        end = declared.next;
        max = Math.min(declared.value, maxPages);
      }
      if (end !== bodyEnd) throw new Error('unexpected bytes in memory section');
      if (min.value > max) throw new Error('module needs more memory than the limit');
      const body = [...writeU32(1), 0x01, ...writeU32(min.value), ...writeU32(max)];
      const section = [MEMORY_SECTION, ...writeU32(body.length), ...body];
      const out = new Uint8Array(pos + section.length + (wasm.length - bodyEnd));
      out.set(wasm.subarray(0, pos), 0);
      out.set(section, pos);
      out.set(wasm.subarray(bodyEnd), pos + section.length);
      return out;
    }
    pos = bodyEnd;
  }
  throw new Error('module defines no memory');
}

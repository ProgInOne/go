import type {} from './webassembly.d.ts';
/**
 * The minimal WASI preview1 that learner programs get (G-002). Only standard input/output, a
 * virtual clock, random bytes and exit are real; there are no preopened folders, sockets or
 * environment variables, so a program cannot reach files, the network or other processes.
 * Every other preview1 function answers ENOSYS. Kept free of Node APIs so it is easy to test.
 */

export const WASI_MODULE = 'wasi_snapshot_preview1';

/** WASI errno values used here. */
export const Errno = {
  SUCCESS: 0,
  BADF: 8,
  INVAL: 28,
  NOSYS: 52,
  NOTSUP: 58,
} as const;

const CLOCK_REALTIME = 0;
const CLOCK_MONOTONIC = 1;
const CLOCK_PROCESS_CPUTIME = 2;
const CLOCK_THREAD_CPUTIME = 3;
const FILETYPE_CHARACTER_DEVICE = 2;
const EVENTTYPE_CLOCK = 0;
const EVENTTYPE_FD_READ = 1;
const EVENTTYPE_FD_WRITE = 2;
const SUBCLOCKFLAG_ABSTIME = 1;
const ALL_RIGHTS = 0x1fffffffn;

/**
 * Where the virtual clock starts: 2009-11-10 23:00:00 UTC, the time the Go Playground shows.
 * `time.Sleep` moves the clock forward instead of waiting, so runs are fast and repeatable.
 */
export const VIRTUAL_EPOCH_NS = 1_257_894_000_000_000_000n;

/** Start of the monotonic clock; the Go runtime refuses a monotonic time of zero. */
const MONOTONIC_BASE_NS = 1_000_000_000n;

/** Thrown by `proc_exit` to unwind out of `_start`. */
export class WasiExit extends Error {
  readonly code: number;
  constructor(code: number) {
    super(`exit ${code}`);
    this.code = code;
  }
}

/** Thrown when output passes the limit; the run stops there. */
export class OutputLimitExceeded extends Error {
  constructor() {
    super('output limit exceeded');
  }
}

export interface WasiOptions {
  stdin: Uint8Array;
  /** Called for each write to fd 1 or 2. */
  onOutput: (fd: 1 | 2, bytes: Uint8Array) => void;
  outputLimitBytes: number;
  /** 32-bit seed for `random_get`; Go seeds `math/rand` from it, so the same seed repeats runs. */
  randomSeed: number;
  programName?: string;
}

/** SplitMix32-style generator: small, fast and good enough for seeding a learner's program. */
function seededBytes(seed: number): (out: Uint8Array) => void {
  let state = seed >>> 0;
  return (out) => {
    for (let i = 0; i < out.length; i += 4) {
      state = (state + 0x9e3779b9) >>> 0;
      let z = state;
      z = Math.imul(z ^ (z >>> 16), 0x85ebca6b) >>> 0;
      z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35) >>> 0;
      z = (z ^ (z >>> 16)) >>> 0;
      for (let b = 0; b < 4 && i + b < out.length; b++) out[i + b] = (z >>> (8 * b)) & 0xff;
    }
  };
}

type WasiFunction = (...args: (number | bigint)[]) => number;

export class MinimalWasi {
  private memory: WebAssembly.Memory | null = null;
  private stdinPos = 0;
  private written = 0;
  /** Nanoseconds since the virtual epoch. */
  private nowNs = 0n;
  private readonly fillRandom: (out: Uint8Array) => void;
  private readonly args: Uint8Array[];
  private readonly options: WasiOptions;

  constructor(options: WasiOptions) {
    this.options = options;
    this.fillRandom = seededBytes(options.randomSeed);
    this.args = [new TextEncoder().encode(`${options.programName ?? 'prog'}\0`)];
  }

  /** Must be called with the instance's exported memory before `_start`. */
  bind(memory: WebAssembly.Memory): void {
    this.memory = memory;
  }

  /** Virtual nanoseconds the program has slept so far. */
  get elapsedNs(): bigint {
    return this.nowNs;
  }

  private view(): DataView {
    if (!this.memory) throw new Error('WASI memory not bound');
    return new DataView(this.memory.buffer);
  }

  private bytes(ptr: number, len: number): Uint8Array {
    if (!this.memory) throw new Error('WASI memory not bound');
    return new Uint8Array(this.memory.buffer, ptr, len);
  }

  /**
   * The import object for `wasi_snapshot_preview1`, covering every function `names` lists
   * (the module's own imports), so a program that touches an unsupported call gets ENOSYS at
   * that call instead of failing to load.
   */
  imports(names: readonly string[]): Record<string, WasiFunction> {
    const impl = this.implemented();
    const out: Record<string, WasiFunction> = {};
    for (const name of names) out[name] = impl[name] ?? (() => Errno.NOSYS);
    return out;
  }

  private implemented(): Record<string, WasiFunction> {
    const n = (v: number | bigint): number => Number(v);
    return {
      args_sizes_get: (argc, bufSize) => {
        const v = this.view();
        v.setUint32(n(argc), this.args.length, true);
        v.setUint32(
          n(bufSize),
          this.args.reduce((s, a) => s + a.length, 0),
          true,
        );
        return Errno.SUCCESS;
      },
      args_get: (argv, buf) => {
        const v = this.view();
        let p = n(buf);
        this.args.forEach((arg, i) => {
          v.setUint32(n(argv) + 4 * i, p, true);
          this.bytes(p, arg.length).set(arg);
          p += arg.length;
        });
        return Errno.SUCCESS;
      },
      environ_sizes_get: (count, bufSize) => {
        const v = this.view();
        v.setUint32(n(count), 0, true);
        v.setUint32(n(bufSize), 0, true);
        return Errno.SUCCESS;
      },
      environ_get: () => Errno.SUCCESS,
      clock_res_get: (id, out) => {
        if (n(id) > CLOCK_THREAD_CPUTIME) return Errno.INVAL;
        this.view().setBigUint64(n(out), 1000n, true);
        return Errno.SUCCESS;
      },
      clock_time_get: (id, _precision, out) => {
        const clock = n(id);
        let value: bigint;
        if (clock === CLOCK_REALTIME) value = VIRTUAL_EPOCH_NS + this.nowNs;
        else if (
          clock === CLOCK_MONOTONIC ||
          clock === CLOCK_PROCESS_CPUTIME ||
          clock === CLOCK_THREAD_CPUTIME
        ) {
          value = MONOTONIC_BASE_NS + this.nowNs;
        } else return Errno.INVAL;
        this.view().setBigUint64(n(out), value, true);
        return Errno.SUCCESS;
      },
      random_get: (buf, len) => {
        this.fillRandom(this.bytes(n(buf), n(len)));
        return Errno.SUCCESS;
      },
      sched_yield: () => Errno.SUCCESS,
      proc_exit: (code) => {
        throw new WasiExit(n(code));
      },
      fd_write: (fd, iovs, iovsLen, nwritten) => {
        const f = n(fd);
        if (f !== 1 && f !== 2) return Errno.BADF;
        const v = this.view();
        let total = 0;
        for (let i = 0; i < n(iovsLen); i++) {
          const ptr = v.getUint32(n(iovs) + 8 * i, true);
          const len = v.getUint32(n(iovs) + 8 * i + 4, true);
          if (len === 0) continue;
          if (this.written + len > this.options.outputLimitBytes) {
            const room = this.options.outputLimitBytes - this.written;
            if (room > 0) this.options.onOutput(f, this.bytes(ptr, room).slice());
            this.written = this.options.outputLimitBytes;
            throw new OutputLimitExceeded();
          }
          this.options.onOutput(f, this.bytes(ptr, len).slice());
          this.written += len;
          total += len;
        }
        v.setUint32(n(nwritten), total, true);
        return Errno.SUCCESS;
      },
      fd_read: (fd, iovs, iovsLen, nread) => {
        if (n(fd) !== 0) return Errno.BADF;
        const v = this.view();
        const stdin = this.options.stdin;
        let total = 0;
        for (let i = 0; i < n(iovsLen) && this.stdinPos < stdin.length; i++) {
          const ptr = v.getUint32(n(iovs) + 8 * i, true);
          const len = v.getUint32(n(iovs) + 8 * i + 4, true);
          const chunk = stdin.subarray(this.stdinPos, this.stdinPos + len);
          this.bytes(ptr, chunk.length).set(chunk);
          this.stdinPos += chunk.length;
          total += chunk.length;
        }
        v.setUint32(n(nread), total, true);
        return Errno.SUCCESS;
      },
      fd_close: (fd) => (n(fd) <= 2 ? Errno.SUCCESS : Errno.BADF),
      fd_fdstat_get: (fd, out) => {
        if (n(fd) > 2) return Errno.BADF;
        const v = this.view();
        const p = n(out);
        this.bytes(p, 24).fill(0);
        v.setUint8(p, FILETYPE_CHARACTER_DEVICE);
        v.setBigUint64(p + 8, ALL_RIGHTS, true);
        v.setBigUint64(p + 16, ALL_RIGHTS, true);
        return Errno.SUCCESS;
      },
      fd_fdstat_set_flags: (fd) => (n(fd) <= 2 ? Errno.SUCCESS : Errno.BADF),
      fd_filestat_get: (fd, out) => {
        if (n(fd) > 2) return Errno.BADF;
        const p = n(out);
        this.bytes(p, 64).fill(0);
        this.view().setUint8(p + 16, FILETYPE_CHARACTER_DEVICE);
        return Errno.SUCCESS;
      },
      // No preopened folders: the first prestat call ends the program's preopen scan.
      fd_prestat_get: () => Errno.BADF,
      fd_prestat_dir_name: () => Errno.BADF,
      path_open: () => Errno.BADF,
      path_filestat_get: () => Errno.BADF,
      poll_oneoff: (inPtr, outPtr, nsubs, neventsPtr) =>
        this.pollOneoff(n(inPtr), n(outPtr), n(nsubs), n(neventsPtr)),
    };
  }

  /**
   * Readiness for stdio, and sleeping on the virtual clock: if no stdio subscription is ready,
   * the clock jumps to the earliest timeout and those clock subscriptions fire.
   */
  private pollOneoff(inPtr: number, outPtr: number, nsubs: number, neventsPtr: number): number {
    if (nsubs === 0) return Errno.INVAL;
    const v = this.view();
    interface Sub {
      userdata: bigint;
      tag: number;
      fd: number;
      deadline: bigint;
    }
    const subs: Sub[] = [];
    for (let i = 0; i < nsubs; i++) {
      const p = inPtr + 48 * i;
      const userdata = v.getBigUint64(p, true);
      const tag = v.getUint8(p + 8);
      if (tag === EVENTTYPE_CLOCK) {
        const timeout = v.getBigUint64(p + 24, true);
        const flags = v.getUint16(p + 40, true);
        const clock = v.getUint32(p + 16, true);
        let deadline: bigint;
        if ((flags & SUBCLOCKFLAG_ABSTIME) !== 0) {
          deadline = timeout - (clock === CLOCK_REALTIME ? VIRTUAL_EPOCH_NS : MONOTONIC_BASE_NS);
        } else deadline = this.nowNs + timeout;
        subs.push({ userdata, tag, fd: -1, deadline });
      } else {
        subs.push({ userdata, tag, fd: v.getUint32(p + 16, true), deadline: 0n });
      }
    }

    const events: { userdata: bigint; error: number; type: number; nbytes: bigint }[] = [];
    for (const s of subs) {
      if (s.tag === EVENTTYPE_FD_READ) {
        if (s.fd === 0) {
          events.push({
            userdata: s.userdata,
            error: 0,
            type: s.tag,
            nbytes: BigInt(this.options.stdin.length - this.stdinPos),
          });
        } else events.push({ userdata: s.userdata, error: Errno.BADF, type: s.tag, nbytes: 0n });
      } else if (s.tag === EVENTTYPE_FD_WRITE) {
        const ok = s.fd === 1 || s.fd === 2;
        events.push({ userdata: s.userdata, error: ok ? 0 : Errno.BADF, type: s.tag, nbytes: 0n });
      } else if (s.tag !== EVENTTYPE_CLOCK) {
        events.push({ userdata: s.userdata, error: Errno.INVAL, type: s.tag, nbytes: 0n });
      }
    }
    if (events.length === 0) {
      const clocks = subs.filter((s) => s.tag === EVENTTYPE_CLOCK);
      const earliest = clocks.reduce(
        (m, s) => (s.deadline < m ? s.deadline : m),
        clocks[0]?.deadline ?? this.nowNs,
      );
      if (earliest > this.nowNs) this.nowNs = earliest;
      for (const s of clocks) {
        if (s.deadline <= this.nowNs)
          events.push({ userdata: s.userdata, error: 0, type: EVENTTYPE_CLOCK, nbytes: 0n });
      }
    }
    events.forEach((e, i) => {
      const p = outPtr + 32 * i;
      this.bytes(p, 32).fill(0);
      v.setBigUint64(p, e.userdata, true);
      v.setUint16(p + 8, e.error, true);
      v.setUint8(p + 10, e.type);
      v.setBigUint64(p + 16, e.nbytes, true);
    });
    v.setUint32(neventsPtr, events.length, true);
    return Errno.SUCCESS;
  }
}

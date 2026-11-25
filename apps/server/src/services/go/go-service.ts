import { randomInt } from 'node:crypto';
import {
  createGoRunner,
  findGoToolchain,
  MIN_GO_VERSION,
  type FindToolchainOptions,
  type FormatResult,
  type GoRunner,
  type GoRunResult,
  type ToolchainLookup,
} from '@proginone/go-runner';
import type { Logger } from '../../observability/logger.ts';

/** What the web app shows about the learner's Go (G-002). Paths are local, never sent elsewhere. */
export interface GoToolchainStatus {
  status: ToolchainLookup['status'];
  /** `go1.27.3`; absent when no Go was found. */
  version: string | null;
  goBin: string | null;
  minVersion: string;
  /** The Go content outputs were checked with (`.go-version`); null if unknown. */
  contentVersion: string | null;
  /** False when the learner's minor version differs from `contentVersion`. */
  matchesContentVersion: boolean | null;
  /** Where the app looked, when no Go was found. */
  searched: string[];
}

export class GoUnavailableError extends Error {
  readonly status: GoToolchainStatus;
  constructor(status: GoToolchainStatus) {
    super(`Go is not available (${status.status})`);
    this.name = 'GoUnavailableError';
    this.status = status;
  }
}

export interface GoServiceOptions {
  /** Folder for the build cache and temporary modules (`<dataDir>/go-runner`). */
  dataDir: string;
  /** `goPath` from config: a `go` binary or its folder. */
  configuredPath?: string;
  /** Contents of `.go-version`, e.g. `1.27.3`. */
  contentVersion: string | null;
  log: Logger;
  /** Replaces the toolchain search (tests). */
  find?: (options: FindToolchainOptions) => Promise<ToolchainLookup>;
  /** Replaces the runner factory (tests). */
  createRunner?: typeof createGoRunner;
}

const minorOf = (v: string) => /^(?:go)?(\d+)\.(\d+)/.exec(v)?.slice(1, 3).join('.') ?? null;

/**
 * Finds the learner's Go, keeps one runner for it and serves runs and `gofmt` (G-002). Detection
 * runs at start and again on `refresh()` (after the learner installs Go). Logs timings and
 * outcomes, never the learner's code or output.
 */
export class GoService {
  private lookup: ToolchainLookup = { status: 'missing', searched: [] };
  private runner: GoRunner | null = null;
  private pending: Promise<GoToolchainStatus> | null = null;
  private readonly options: GoServiceOptions;

  constructor(options: GoServiceOptions) {
    this.options = options;
  }

  /** Detects Go again; while one detection runs, callers share it. */
  refresh(): Promise<GoToolchainStatus> {
    this.pending ??= this.detect().finally(() => {
      this.pending = null;
    });
    return this.pending;
  }

  private async detect(): Promise<GoToolchainStatus> {
    const find = this.options.find ?? findGoToolchain;
    const { configuredPath } = this.options;
    this.lookup = await find(configuredPath === undefined ? {} : { configuredPath });
    this.runner =
      this.lookup.status === 'ok'
        ? (this.options.createRunner ?? createGoRunner)({
            toolchain: this.lookup.toolchain,
            dataDir: this.options.dataDir,
          })
        : null;
    const status = this.status();
    if (status.status === 'ok') {
      this.options.log.info({ version: status.version, goBin: status.goBin }, 'Go toolchain found');
    } else {
      this.options.log.warn(
        { status: status.status, version: status.version, goBin: status.goBin },
        'Go toolchain unavailable; code runs are off',
      );
    }
    return status;
  }

  /** Detects Go, then fills the build cache in the background so the first run is fast. */
  async start(): Promise<void> {
    await this.refresh();
    const runner = this.runner;
    if (!runner) return;
    const started = performance.now();
    runner.prewarm().then(
      () => {
        this.options.log.info(
          { ms: Math.round(performance.now() - started) },
          'Go build cache warmed',
        );
      },
      (err: unknown) => {
        this.options.log.warn({ err }, 'Go prewarm failed');
      },
    );
  }

  status(): GoToolchainStatus {
    const l = this.lookup;
    const version =
      l.status === 'ok' ? l.toolchain.version.raw : l.status === 'too-old' ? l.version.raw : null;
    const contentVersion = this.options.contentVersion ? `go${this.options.contentVersion}` : null;
    return {
      status: l.status,
      version,
      goBin: l.status === 'ok' ? l.toolchain.goBin : l.status === 'missing' ? null : l.goBin,
      minVersion: `go${MIN_GO_VERSION.major}.${MIN_GO_VERSION.minor}`,
      contentVersion,
      matchesContentVersion:
        version && contentVersion ? minorOf(version) === minorOf(contentVersion) : null,
      searched: l.status === 'missing' ? l.searched : [],
    };
  }

  private requireRunner(): GoRunner {
    if (!this.runner) throw new GoUnavailableError(this.status());
    return this.runner;
  }

  /**
   * A free run of one `main.go` (lesson examples, the playground). Not graded, so `math/rand`
   * gets a fresh seed each time.
   */
  async runProgram(source: string, stdin: string): Promise<GoRunResult> {
    const runner = this.requireRunner();
    const result = await runner.run({
      files: [{ name: 'main.go', content: source }],
      stdin,
      randomSeed: randomInt(0, 2 ** 31),
    });
    if (result.phase === 'compile') {
      this.options.log.info(
        { phase: 'compile', reason: result.compile.reason, compileMs: result.compile.durationMs },
        'go run',
      );
    } else {
      this.options.log.info(
        {
          phase: 'run',
          reason: result.run.reason,
          exitCode: result.run.exitCode,
          compileMs: result.compileMs,
          runMs: result.run.durationMs,
          ...(result.run.internalMessage === undefined
            ? {}
            : { internalMessage: result.run.internalMessage }),
        },
        result.run.reason === 'crash' ? 'go run crashed' : 'go run',
      );
    }
    return result;
  }

  async format(source: string): Promise<FormatResult> {
    const result = await this.requireRunner().format(source);
    if (!result.ok && result.reason !== 'syntax-error') {
      this.options.log.warn({ reason: result.reason }, 'gofmt failed');
    }
    return result;
  }
}

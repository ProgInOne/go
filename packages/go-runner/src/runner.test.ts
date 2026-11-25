import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { beforeAll, describe, expect, it } from 'vitest';

import { createGoRunner, type GoRunner, type GoRunResult } from './runner.ts';
import type { RunResult } from './run.ts';
import { testToolchain } from './test-go.ts';

const toolchain = await testToolchain();

/** Real Go compile and run (G-002). The first build fills a cold cache, hence the long setup. */
describe.skipIf(!toolchain)('createGoRunner', () => {
  let runner: GoRunner;

  beforeAll(async () => {
    if (!toolchain) return;
    runner = createGoRunner({ toolchain, dataDir: await mkdtemp(join(tmpdir(), 'go-runner-')) });
    await runner.prewarm();
  }, 180_000);

  function ran(result: GoRunResult): RunResult {
    if (result.phase !== 'run') throw new Error(`did not run: ${JSON.stringify(result.compile)}`);
    return result.run;
  }

  const main = (body: string, imports: string[] = []) => ({
    files: [
      {
        name: 'main.go',
        content: `package main\n\n${imports.map((i) => `import "${i}"\n`).join('')}\nfunc main() {\n${body}\n}\n`,
      },
    ],
  });

  it('prints standard output and reads standard input', async () => {
    const result = ran(
      await runner.run({
        ...main('var name string\nfmt.Scanln(&name)\nfmt.Println("합계:", 3+4, name)', ['fmt']),
        stdin: 'gopher\n',
      }),
    );
    expect(result).toMatchObject({
      reason: 'exit',
      exitCode: 0,
      stdout: '합계: 7 gopher\n',
      stderr: '',
    });
  });

  it('has no files to open', async () => {
    const result = ran(
      await runner.run(
        main('_, err := os.ReadFile("/etc/hosts")\nfmt.Println(err != nil)', ['fmt', 'os']),
      ),
    );
    expect(result.stdout).toBe('true\n');
  });

  it('sleeps on a virtual clock that starts at the Playground time', async () => {
    const result = ran(
      await runner.run(
        main(
          'start := time.Now()\ntime.Sleep(time.Hour)\nfmt.Println(start.UTC(), time.Since(start))',
          ['fmt', 'time'],
        ),
      ),
    );
    expect(result.stdout).toBe('2009-11-10 23:00:00 +0000 UTC 1h0m0s\n');
    expect(result.virtualMs).toBe(3_600_000);
    expect(result.durationMs).toBeLessThan(3_000);
  });

  it('wakes sleeping goroutines in virtual-time order', async () => {
    const body = `var wg sync.WaitGroup
for i := range 3 {
	wg.Add(1)
	go func() {
		defer wg.Done()
		time.Sleep(time.Duration(3-i) * time.Second)
		fmt.Println(i)
	}()
}
wg.Wait()`;
    expect(ran(await runner.run(main(body, ['fmt', 'sync', 'time']))).stdout).toBe('2\n1\n0\n');
  });

  it('repeats math/rand for the same seed', async () => {
    const program = main('fmt.Println(rand.Intn(1_000_000))', ['fmt', 'math/rand']);
    const a = ran(await runner.run({ ...program, randomSeed: 7 })).stdout;
    const b = ran(await runner.run({ ...program, randomSeed: 7 })).stdout;
    const c = ran(await runner.run({ ...program, randomSeed: 8 })).stdout;
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });

  it('reports exit codes, panics and fatal errors', async () => {
    expect(ran(await runner.run(main('os.Exit(3)', ['os'])))).toMatchObject({
      reason: 'exit',
      exitCode: 3,
    });
    const panic = ran(await runner.run(main('var a []int\n_ = a[3]')));
    expect(panic).toMatchObject({ reason: 'panic', exitCode: 2 });
    expect(panic.stderr).toContain('panic: runtime error: index out of range [3] with length 0');
    const deadlock = ran(await runner.run(main('c := make(chan int)\n<-c')));
    expect(deadlock).toMatchObject({ reason: 'fatal', exitCode: 2 });
    expect(deadlock.stderr).toContain('all goroutines are asleep - deadlock!');
  });

  it('stops an endless loop at the time limit', async () => {
    const result = ran(await runner.run({ ...main('for {\n}'), limits: { timeoutMs: 500 } }));
    expect(result).toMatchObject({ reason: 'timeout', exitCode: null });
  });

  it('stops at the memory limit', async () => {
    const body = 'var keep [][]byte\nfor {\n\tkeep = append(keep, make([]byte, 1<<20))\n}';
    const result = ran(
      await runner.run({ ...main(body), limits: { memoryLimitBytes: 64 * 1024 * 1024 } }),
    );
    expect(result.reason).toBe('memory');
    expect(result.stderr).toContain('out of memory');
  });

  it('keeps output up to the limit and stops there', async () => {
    const result = ran(
      await runner.run({
        ...main('for {\n\tfmt.Println("go")\n}', ['fmt']),
        limits: { outputLimitBytes: 1000 },
      }),
    );
    expect(result.reason).toBe('output-limit');
    expect(result.stdout).toHaveLength(1000);
    expect(result.stdout.startsWith('go\ngo\n')).toBe(true);
  });

  it('returns compiler errors as written, with positions', async () => {
    const result = await runner.run({
      files: [
        { name: 'main.go', content: 'package main\n\nfunc main() {\n\tx := 1\n\tx := 2\n}\n' },
      ],
    });
    expect(result.phase).toBe('compile');
    if (result.phase !== 'compile' || result.compile.reason !== 'compile-error')
      throw new Error('expected compile error');
    expect(result.compile.output).toContain('./main.go:5:4: no new variables on left side of :=');
    expect(result.compile.output).not.toContain('# prog');
    expect(result.compile.diagnostics).toContainEqual({
      file: 'main.go',
      line: 5,
      column: 4,
      message: 'no new variables on left side of :=',
    });
  });

  it('builds only the standard library, offline', async () => {
    const result = await runner.run(main('bar.X()', ['github.com/example/bar']));
    expect(result.phase).toBe('compile');
    if (result.phase !== 'compile' || result.compile.reason !== 'compile-error')
      throw new Error('expected compile error');
    expect(result.compile.output).toContain('GOPROXY=off');
  });

  it('cannot embed files outside the temporary module', async () => {
    const content =
      'package main\n\nimport _ "embed"\n\n//go:embed ../../../../etc/hosts\nvar s string\n\nfunc main() { println(s) }\n';
    const result = await runner.run({ files: [{ name: 'main.go', content }] });
    expect(result.phase).toBe('compile');
  });

  it("ignores the server's GOFLAGS", async () => {
    const saved = process.env['GOFLAGS'];
    process.env['GOFLAGS'] = '-toolexec=/nonexistent-tool';
    try {
      expect(ran(await runner.run(main('println("ok")'))).stderr).toBe('ok\n');
    } finally {
      if (saved === undefined) delete process.env['GOFLAGS'];
      else process.env['GOFLAGS'] = saved;
    }
  });

  it('formats with gofmt and leaves broken code alone', async () => {
    expect(await runner.format('package main\nfunc main(){x:=1\n_=x}\n')).toEqual({
      ok: true,
      source: 'package main\n\nfunc main() {\n\tx := 1\n\t_ = x\n}\n',
    });
    expect(await runner.format('package main\nfunc main( {\n')).toMatchObject({
      ok: false,
      reason: 'syntax-error',
      diagnostics: [{ file: 'main.go', line: 2 }],
    });
  });
});

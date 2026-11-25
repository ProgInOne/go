import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createGoRunner, findGoToolchain, type GoRunner } from '@proginone/go-runner';
import { beforeAll, describe, expect, it } from 'vitest';
import { checkContent } from './check.ts';
import { runCheckContent } from './run-check.ts';
import { FIXTURE_BLOCKS, LESSON_MDX, lessonMdx, writeContent } from './test/fixture.ts';

const lookup = await findGoToolchain();
if (lookup.status !== 'ok' && process.env['CI']) throw new Error('CI needs Go for run-check');

const example = (id: string, code: string, extra = '') =>
  `<RunnableExample id="${id}" lang="go"${extra}>\n\n\`\`\`go\n${code}\n\`\`\`\n\n</RunnableExample>`;

const GOOD = 'package main\n\nimport "fmt"\n\nfunc main() {\n\tfmt.Println("합계:", 3+4)\n}';
const UNFORMATTED = 'package main\n\nimport "fmt"\n\nfunc main() {\n    fmt.Println(1)\n}';
const UNUSED = 'package main\n\nfunc main() {\n\tx := 1\n}';
const PANICS = 'package main\n\nfunc main() {\n\tvar a []int\n\t_ = a[1]\n}';

/** Lesson examples run with the real Go (G-002). */
describe.skipIf(lookup.status !== 'ok')('runCheckContent', () => {
  let runner: GoRunner;
  beforeAll(async () => {
    if (lookup.status !== 'ok') return;
    runner = createGoRunner({
      toolchain: lookup.toolchain,
      dataDir: await mkdtemp(join(tmpdir(), 'run-check-')),
    });
    await runner.prewarm();
  }, 180_000);

  async function check(examples: string) {
    const result = checkContent(
      writeContent((files) => {
        files[LESSON_MDX] = lessonMdx({ ...FIXTURE_BLOCKS, examples });
      }),
    );
    // The fixture's own notes (e.g. a pitfall without its misconception) are not ours.
    const before = result.diagnostics.items.length;
    expect(result.diagnostics.items.filter((d) => d.level === 'error')).toEqual([]);
    const stats = await runCheckContent(result, runner);
    return { stats, messages: result.diagnostics.items.slice(before).map((d) => d.message) };
  }

  it('passes formatted examples that run, and expectError examples that do not compile', async () => {
    const { stats, messages } = await check(
      `${example('sum', GOOD)}\n\n${example('unused', UNUSED, ' expectError')}`,
    );
    expect(messages).toEqual([]);
    expect(stats).toEqual({ examples: 2, passed: 2 });
  });

  it('reports code gofmt would change, compile errors, panics and wrong expectError marks', async () => {
    const { stats, messages } = await check(
      [
        example('spaces', UNFORMATTED),
        example('unused', UNUSED),
        example('panics', PANICS),
        example('fine', GOOD, ' expectError'),
      ].join('\n\n'),
    );
    expect(stats).toEqual({ examples: 4, passed: 0 });
    expect(messages).toEqual([
      expect.stringMatching(
        /^<RunnableExample id="spaces"> \(\d+행\): gofmt 형식이 아닙니다\(코드 6번째 줄부터\)\. gofmt로 정리한 코드를 쓰세요$/,
      ),
      expect.stringMatching(
        /^<RunnableExample id="unused"> \(\d+행\): 컴파일 오류가 납니다\. 의도한 오류라면 expectError를 표시하세요: \.\/main\.go:4:2: declared and not used: x$/,
      ),
      expect.stringMatching(
        /^<RunnableExample id="panics"> \(\d+행\): 오류 없이 끝나야 합니다\(panic, 종료 코드 2\): panic: runtime error: index out of range \[1\] with length 0$/,
      ),
      expect.stringMatching(
        /^<RunnableExample id="fine"> \(\d+행\): expectError로 표시했지만 컴파일됩니다/,
      ),
    ]);
  });
});

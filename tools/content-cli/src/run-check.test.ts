import { readFileSync, writeFileSync } from 'node:fs';
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
    const stats = await runCheckContent(result, runner, { root: result.source.root });
    return { stats, messages: result.diagnostics.items.slice(before).map((d) => d.message) };
  }

  it('passes formatted examples that run, and expectError examples that do not compile', async () => {
    const { stats, messages } = await check(
      `${example('sum', GOOD)}\n\n${example('unused', UNUSED, ' expectError')}`,
    );
    expect(messages).toEqual([]);
    expect(stats).toMatchObject({ examples: 2, passed: 2 });
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
    expect(stats).toMatchObject({ examples: 4, passed: 0 });
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

  describe('predict_output', () => {
    const PREDICT_YAML =
      'courses/go-basics/modules/01-start/lessons/01-first-program/exercises/002-predict.yaml';
    const predict = (spec: Record<string, unknown>, status = 'approved') =>
      writeContent((files) => {
        files[PREDICT_YAML] = {
          id: 'go-basics.start.first-program.predict-sum',
          type: 'predict_output',
          difficulty: 2,
          concepts: [{ id: 'go.basics.println', weight: 1 }],
          estimatedSeconds: 60,
          prompt: '무엇이 출력되나요?',
          spec,
          hints: ['a', 'b', 'c'],
          explanation: '설명',
          review:
            status === 'approved'
              ? { status, draftedBy: 'ai:claude', reviewedBy: 'ai:reviewer' }
              : { status, draftedBy: 'ai:claude' },
        };
      });
    const errorsOf = (root: string) =>
      checkContent(root)
        .diagnostics.items.filter((d) => d.file.includes('predict'))
        .map((d) => `${d.level} ${d.message}`);

    it('records the answer key from a real run, and check fills it in afterwards', async () => {
      const root = predict({ code: GOOD, answerKind: 'output' });
      expect(errorsOf(root)).toEqual([
        'error 실행 기대값이 아직 없습니다. pnpm content:check:run으로 계산하세요',
      ]);

      const result = checkContent(root, { skipExpectations: true });
      const stats = await runCheckContent(result, runner, { root });
      expect(stats).toMatchObject({ predicts: 1, predictsPassed: 1, expectationsChanged: true });
      expect(
        JSON.parse(readFileSync(join(root, '.generated/predict-expected.json'), 'utf8')),
      ).toMatchObject({
        entries: {
          'go-basics.start.first-program.predict-sum': {
            expected: { kind: 'output', lines: ['합계: 7'] },
          },
        },
      });

      const after = checkContent(root);
      expect(errorsOf(root)).toEqual([]);
      const spec = after.source.courses[0]?.modules[0]?.lessons[0]?.exercises.find(
        (x) => x.data.type === 'predict_output',
      )?.data.spec;
      expect(spec?.['expected']).toEqual({ kind: 'output', lines: ['합계: 7'] });

      // Unchanged: a frozen run passes. Changed code: check says the key is stale.
      const again = await runCheckContent(checkContent(root, { skipExpectations: true }), runner, {
        root,
        frozen: true,
      });
      expect(again.expectationsChanged).toBe(false);
      const yaml = join(root, PREDICT_YAML);
      writeFileSync(yaml, readFileSync(yaml, 'utf8').replace('3+4', '3+5'));
      expect(errorsOf(root)).toEqual([
        expect.stringContaining('error 코드가 바뀌어 실행 기대값이 낡았습니다'),
      ]);
      const frozen = checkContent(root, { skipExpectations: true });
      await runCheckContent(frozen, runner, { root, frozen: true });
      expect(frozen.diagnostics.items.map((d) => d.message)).toContainEqual(
        expect.stringContaining('최신이 아닙니다'),
      );
    });

    it('picks the choice that matches, compile errors included', async () => {
      const root = predict({
        code: UNUSED,
        answerKind: 'choice',
        choices: [
          { id: 'a', text: '1' },
          { id: 'b', text: '컴파일 오류가 난다', outcome: 'compile-error' },
        ],
      });
      const stats = await runCheckContent(checkContent(root, { skipExpectations: true }), runner, {
        root,
      });
      expect(stats.predictsPassed).toBe(1);
      const after = checkContent(root);
      const spec = after.source.courses[0]?.modules[0]?.lessons[0]?.exercises.find(
        (x) => x.data.type === 'predict_output',
      )?.data.spec;
      expect(spec?.['expected']).toEqual({ kind: 'choice', choiceId: 'b' });
    });

    it('rejects programs whose result depends on randomness', async () => {
      const code =
        'package main\n\nimport "fmt"\n\nfunc main() {\n\tm := map[int]bool{1: true, 2: true, 3: true, 4: true, 5: true, 6: true, 7: true, 8: true}\n\tfor k := range m {\n\t\tfmt.Print(k)\n\t}\n}';
      const root = predict({ code, answerKind: 'output' }, 'draft');
      const result = checkContent(root, { skipExpectations: true });
      const stats = await runCheckContent(result, runner, { root });
      expect(stats.predictsPassed).toBe(0);
      expect(result.diagnostics.items.map((d) => d.message)).toContainEqual(
        expect.stringContaining('실행할 때마다 결과가 다릅니다'),
      );
    });
  });
});

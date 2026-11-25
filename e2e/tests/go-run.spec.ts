import { expect, test, type Page } from '@playwright/test';
import { expectNoA11yViolations } from './fixtures.ts';

// Go examples run on the local server with the real Go (G-002). CI installs `.go-version`
// (actions/setup-go) for this job. The fixture lesson has no example, so the lesson response
// gets one here; that keeps the lesson's visual baselines as they are.

const LESSON = '/learn/go-basics.start.first-program';
const CODE = 'package main\n\nimport "fmt"\n\nfunc main() {\n\tfmt.Println("합계:", 3+4)\n}';
const BROKEN = 'package main\n\nfunc main() {\n\tx := 1\n}';

const example = (id: string, code: string, extra: Record<string, unknown> = {}) => ({
  type: 'component',
  name: 'RunnableExample',
  props: { id, lang: 'go', code, editable: true, ...extra },
  children: [],
});

async function withExamples(page: Page) {
  await page.route('**/api/v1/lessons/go-basics.start.first-program', async (route) => {
    const res = await route.fetch();
    const lesson = (await res.json()) as { body: unknown[] };
    lesson.body.push({
      type: 'component',
      name: 'Section',
      props: { kind: 'examples', id: 'go-run-test', title: '실행 예제 시험' },
      children: [example('sum', CODE), example('broken', BROKEN, { expectError: true })],
    });
    await route.fulfill({ response: res, json: lesson });
  });
}

test.describe('Go examples', () => {
  // The first run may build the standard library into an empty cache.
  test.describe.configure({ timeout: 120_000 });

  test.beforeEach(async ({ page }) => {
    await page.goto('/settings/go');
    const status = await page.evaluate(async () => {
      const token =
        document.querySelector<HTMLMetaElement>('meta[name="proginone-token"]')?.content ?? '';
      const res = await fetch('/api/v1/go/toolchain', { headers: { 'x-proginone-token': token } });
      return (await res.json()) as { status: string };
    });
    test.skip(status.status !== 'ok' && !process.env['CI'], 'Go is not installed here');
    expect(status.status, 'CI installs Go for this job').toBe('ok');
  });

  test('runs, edits, formats and shows compile errors under the app CSP', async ({ page }) => {
    const problems: string[] = [];
    page.on('console', (msg) => {
      if (/Content Security Policy|Refused to/i.test(msg.text())) problems.push(msg.text());
    });
    page.on('pageerror', (error) => problems.push(error.message));
    await withExamples(page);
    await page.goto(LESSON);

    const sum = page.locator('figure.lesson-example').first();
    await sum.scrollIntoViewIfNeeded();
    await sum.getByRole('button', { name: /^실행/ }).click();
    await expect(sum.getByLabel('표준 출력')).toHaveText('합계: 7', { timeout: 90_000 });

    // Edit: the Go editor loads lazily; gofmt runs on the server.
    await sum.getByRole('button', { name: '코드 수정' }).click();
    const editor = sum.getByRole('textbox', { name: '예제 코드 편집 (Go)' });
    await expect(editor).toBeVisible();
    await editor.click();
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.insertText('package main\nimport "fmt"\nfunc main(){fmt.Println(1+1)}\n');
    await sum.getByRole('button', { name: 'gofmt로 정리' }).click();
    await expect(editor).toContainText('func main() { fmt.Println(1 + 1) }');
    await sum.getByRole('button', { name: /다시 실행/ }).click();
    await expect(sum.getByLabel('표준 출력')).toHaveText('2');

    const broken = page.locator('figure.lesson-example').nth(1);
    await broken.getByRole('button', { name: /^실행/ }).click();
    await expect(broken.getByLabel('컴파일 오류')).toContainText(
      './main.go:4:2: declared and not used: x',
    );
    await expect(broken.getByText(/컴파일 오류를 보여 주는 예제/)).toBeVisible();

    await expectNoA11yViolations(page);
    expect(problems).toEqual([]);
  });

  test('settings show the Go the app found', async ({ page }) => {
    await page.goto('/settings/go');
    await expect(page.getByRole('heading', { level: 1, name: 'Go 실행 환경' })).toBeVisible();
    await expect(page.getByText(/^go1\.\d+/)).toBeVisible();
  });
});

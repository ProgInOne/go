import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { expectNoA11yViolations } from './fixtures.ts';

/**
 * Go code exercises on their own server (playwright.config.ts `E2E_CODE_URL`, content overlay
 * fixtures/code): predict_output graded against the build-time run, implement_function graded by
 * the server running the learner's code with the real Go (G-003). CI installs `.go-version`.
 */

const URL = process.env['E2E_CODE_URL'] ?? '';
const LESSON = '/learn/go-basics.start.write-code';
const P = 'go-basics.start.write-code.';

test.use({ baseURL: URL });
test.describe.configure({ mode: 'serial', timeout: 180_000 });

async function api(
  page: Page,
  request: APIRequestContext,
  method: 'GET' | 'PATCH',
  path: string,
  data?: object,
) {
  const token = (await page.locator('meta[name="proginone-token"]').getAttribute('content')) ?? '';
  const res = await request.fetch(new globalThis.URL(`/api/v1${path}`, page.url()).href, {
    method,
    headers: { 'x-proginone-token': token },
    ...(data ? { data } : {}),
  });
  expect(res.ok()).toBe(true);
  return (await res.json()) as Record<string, unknown>;
}

async function typeCode(page: Page, code: string) {
  const editor = page.getByRole('textbox', { name: '코드 편집 (main.go)' });
  await editor.click();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.insertText(code);
}

test('predicts output and writes Go code graded by the server', async ({ page, request }) => {
  await page.goto('/settings/go');
  const toolchain = await api(page, request, 'GET', '/go/toolchain');
  test.skip(toolchain['status'] !== 'ok' && !process.env['CI'], 'Go is not installed here');
  expect(toolchain['status'], 'CI installs Go for this job').toBe('ok');
  await api(page, request, 'PATCH', '/learner', { onboarded: true });

  await page.goto(LESSON);
  await page.getByRole('link', { name: '연습 시작' }).click();
  const main = page.getByRole('main');
  const progress = page.getByRole('navigation', { name: '연습 진행' });
  await expect(progress).toBeVisible();
  const total = await progress.getByRole('button').count();
  expect(total).toBe(4);

  const seen: string[] = [];
  for (let n = 0; n < total; n++) {
    const id = (
      (await page.locator('.practice-layout').getAttribute('data-exercise-id')) ?? ''
    ).replace(P, '');
    seen.push(id);
    switch (id) {
      case 'predict-lines':
        // One of two lines right: partial, with the wrong line pointed out.
        await main.getByLabel('예상한 출력').fill('합계:7\n끝');
        await page.keyboard.press('ControlOrMeta+Enter');
        await expect(main.getByRole('heading', { name: '부분 정답이에요.' })).toBeVisible();
        await expect(main.getByText('1번째 줄이 실제 출력과 달라요.')).toBeVisible();
        await main.getByRole('button', { name: '다시 풀기' }).click();
        await main.getByLabel('예상한 출력').fill('합계: 7\n끝');
        await page.keyboard.press('ControlOrMeta+Enter');
        break;
      case 'predict-unused':
        await main.locator('label', { hasText: '컴파일 오류가 난다' }).click();
        await page.keyboard.press('ControlOrMeta+Enter');
        break;
      case 'implement-add':
        await expect(main.getByText('Add(3, 4)의 결과가 7')).toBeVisible();
        await expect(main.getByText('숨겨진 사례 2')).toBeVisible();
        // The starter as is: both cases fail; the hidden case shows no values.
        await main
          .getByRole('button', { name: /확실해요|제출/ })
          .first()
          .click();
        await expect(main.getByRole('heading', { name: '정답이 아니에요.' })).toBeVisible({
          timeout: 90_000,
        });
        await expect(main.getByText('3000')).toHaveCount(0);
        await expectNoA11yViolations(page);
        await main.getByRole('button', { name: '다시 풀기' }).click();
        await typeCode(page, 'package main\n\nfunc Add(a, b int) int {\n\treturn a + b\n}\n');
        await main.getByRole('button', { name: /확실해요/ }).click();
        break;
      case 'program-greet':
        await typeCode(
          page,
          'package main\n\nimport "fmt"\n\nfunc main() {\n\tvar name string\n\tfmt.Scanln(&name)\n\tfmt.Println("안녕,", name)\n}\n',
        );
        await main.getByRole('button', { name: '실행', exact: true }).click();
        await expect(main.getByLabel('표준 출력')).toHaveText('안녕, 고퍼', { timeout: 90_000 });
        await main.getByRole('button', { name: /확실해요/ }).click();
        break;
      default:
        throw new Error(`unexpected exercise ${id}`);
    }
    await expect(main.getByRole('heading', { name: /정답이에요/ })).toBeVisible({
      timeout: 90_000,
    });
    await main
      .getByRole('button', { name: /다음 문제|결과 보기/ })
      .first()
      .click();
  }
  expect(seen.sort()).toEqual([
    'implement-add',
    'predict-lines',
    'predict-unused',
    'program-greet',
  ]);
  await expect(page.getByRole('region', { name: /마쳤어요/ })).toBeVisible();
});

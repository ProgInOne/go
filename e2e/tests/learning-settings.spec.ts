import { expect, test } from '@playwright/test';

/**
 * 설정 > 학습 방식 and 화면 change what the lesson shows (JS D-046). Runs on the 설정 > 데이터 server
 * (playwright.config.ts `E2E_DATA_SETTINGS_URL`) so other tests keep the default settings; the
 * defaults are restored at the end.
 */

const URL = process.env['E2E_DATA_SETTINGS_URL'] ?? '';
const LESSON = '/learn/go-basics.start.first-program';

/** The keys this spec changes, at their defaults (@proginone/shared settings.ts). */
const DEFAULTS = {
  'practice.askConfidence': true,
  'lesson.predictFirst': 'recommended',
  'lesson.fontSize': 'medium',
};

test.use({ baseURL: URL });

test.afterEach(async ({ page, request }) => {
  await page.goto('/settings/appearance');
  const token = (await page.locator('meta[name="proginone-token"]').getAttribute('content')) ?? '';
  const res = await request.patch(`${URL}/api/v1/settings`, {
    headers: { 'x-proginone-token': token },
    data: DEFAULTS,
  });
  expect(res.ok()).toBe(true);
});

test('learning settings change the lesson: confidence and body size', async ({ page }) => {
  await page.goto(LESSON);
  const check = page.locator('.lesson-inline-check').first();
  await expect(check.getByRole('button', { name: /확실해요/ })).toBeVisible();

  await page.goto('/settings/learning');
  await page.getByRole('checkbox', { name: /확신도 묻기/ }).click();
  await expect(page.getByRole('checkbox', { name: /확신도 묻기/ })).not.toBeChecked();
  await page.getByRole('link', { name: '화면' }).click();
  await page.getByRole('radio', { name: /크게/ }).click();
  await expect(page.getByRole('radio', { name: /크게/ })).toBeChecked();

  await page.goto(LESSON);
  // One submit button, no confidence (ui-ux.md 확신도 입력 타이밍).
  await expect(check.getByRole('button', { name: /^제출/ })).toBeVisible();
  await expect(check.getByRole('button', { name: /확실해요/ })).toHaveCount(0);
  // 20px lesson body.
  await expect(page.locator('.lesson-prose').first()).toHaveCSS('font-size', '20px');
});

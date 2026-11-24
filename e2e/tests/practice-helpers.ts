import { expect, type Page } from '@playwright/test';

/**
 * Answers for the E2E fixture lesson's exercises (e2e/fixtures/content), shared by the practice
 * and review flows. Item order comes from the engine (seeded per set), so items are answered by
 * exercise id. Every fixture exercise is one of the common choice types (G-001).
 */

const P = 'go-basics.start.first-program.';

/** Answers one item correctly. The first time through, also exercises wrong answers and hints. */
export async function answer(page: Page, exerciseId: string, firstSet: boolean) {
  const main = page.getByRole('main');
  const submitSure = () => page.keyboard.press('ControlOrMeta+Enter');
  switch (exerciseId.replace(P, '')) {
    case 'mcq-println-role':
      if (firstSet) {
        // Wrong and confident first, then retry: feedback, misconception and retry path.
        await main.locator('label', { hasText: '저장되어' }).click();
        await main.getByRole('button', { name: /확실해요/ }).click();
        await expect(main.getByRole('heading', { name: '정답이 아니에요.' })).toBeVisible();
        await expect(main.getByText(/확신했는데 아니었네요/)).toBeVisible();
        await expect(main.getByRole('group').getByText('출력을 반환으로 착각함')).toBeVisible();
        await main.getByRole('button', { name: '다시 풀기' }).click();
        await main.locator('label', { hasText: '글자가 보인다' }).click();
        await main.getByRole('button', { name: '애매해요' }).click();
      } else {
        await main.locator('label', { hasText: '글자가 보인다' }).click();
        await submitSure();
      }
      break;
    case 'mcq-first-line':
      if (firstSet) {
        // Hint ladder: one step at a time, also with ⌘. (the server records each level).
        await main.getByRole('button', { name: /힌트 1\/3 보기/ }).click();
        await expect(main.getByText('책을 읽는 방향을 떠올려 보세요.')).toBeVisible();
        await page.keyboard.press('ControlOrMeta+.');
        await expect(main.getByText('문장은 한 문장씩 차례로 실행돼요.')).toBeVisible();
      }
      await main.locator('label', { hasText: '맨 위의 문장' }).click();
      await submitSure();
      break;
    case 'multi-println-facts':
      if (firstSet) {
        // Partial answer first (one of two correct options), then complete it.
        await main.locator('label', { hasText: '한 줄이 생긴다' }).click();
        await submitSure();
        await expect(main.getByRole('heading', { name: '부분 정답이에요.' })).toBeVisible();
        await expect(main.getByText('빠뜨린 정답이 있습니다.')).toBeVisible();
        await main.getByRole('button', { name: '다시 풀기' }).click();
      } else {
        await main.locator('label', { hasText: '한 줄이 생긴다' }).click();
      }
      await main.locator('label', { hasText: '값을 화면에 보여 준다' }).click();
      await submitSure();
      break;
    case 'tf-order':
      await main.locator('label', { hasText: '거짓' }).click();
      await main.locator('label', { hasText: '적힌 순서대로' }).click();
      await submitSure();
      break;
    case 'mcq-import-fmt':
      await main.locator('label', { hasText: 'import "fmt"' }).click();
      await submitSure();
      break;
    case 'tf-main-start':
      await main.locator('label', { hasText: '참' }).click();
      await submitSure();
      break;
    // Module 2 concepts: other specs on the shared server (assessment.spec.ts) practise them, so
    // they can come up in a later review set.
    case 'go-basics.values.variables.mcq-var':
      await main.locator('label', { hasText: 'var' }).click();
      await submitSure();
      break;
    case 'go-basics.values.variables.mcq-const':
      await main.locator('label', { hasText: '컴파일 오류가 난다' }).click();
      await submitSure();
      break;
    case 'go-basics.values.variables.mcq-reassign':
      await main
        .locator('label')
        .filter({ has: page.getByRole('radio', { name: '2', exact: true }) })
        .click();
      await submitSure();
      break;
    default:
      throw new Error(`unexpected exercise ${exerciseId}`);
  }
  await expect(main.getByRole('heading', { name: '정답이에요.' })).toBeVisible({
    timeout: 15_000,
  });
}

/** Answers every item of the open set, in the order the engine chose. */
export async function solveSet(page: Page, firstSet: boolean) {
  const progress = page.getByRole('navigation', { name: '연습 진행' });
  const total = await progress.getByRole('button').count();
  const seen = new Set<string>();
  for (let n = 0; n < total; n++) {
    const layout = page.locator('.practice-layout');
    seen.add((await layout.getAttribute('data-type')) ?? '');
    await answer(page, (await layout.getAttribute('data-exercise-id')) ?? '', firstSet);
    await expect(progress).toContainText(`${n + 1} / ${total}`);
    await page
      .getByRole('main')
      .getByRole('button', { name: /다음 문제|결과 보기/ })
      .first()
      .click();
  }
  return { total, seen };
}

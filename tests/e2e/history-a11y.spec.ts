import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { apiError, mockApi, ok } from './support/api.ts';
import { fixture, uploadFile } from './support/files.ts';

async function expectNoSeriousA11yViolations(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  const serious = results.violations.filter(
    (v) => v.impact === 'serious' || v.impact === 'critical',
  );
  expect(serious.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
}

test.describe('history', () => {
  test('keeps results after reload and reopens them without calling the API', async ({ page }) => {
    const bodies = await mockApi(page, ok());
    await page.goto('./');
    await uploadFile(page, 'contract-pl.pdf');
    await expect(page.getByRole('heading', { name: 'Podsumowanie' })).toBeVisible();

    await page.reload();
    const history = page.getByRole('region', { name: 'Historia analiz' });
    await history.getByRole('button', { name: /^contract-pl\.pdf/ }).click();
    await expect(page.getByRole('heading', { name: 'Umowa serwisowa nr 5/2026' })).toBeVisible();
    expect(bodies).toHaveLength(1);
  });

  test('removes a single entry and clears the whole history', async ({ page }) => {
    await mockApi(page, ok());
    await page.goto('./');
    await uploadFile(page, 'contract-pl.pdf');
    await expect(page.getByRole('heading', { name: 'Podsumowanie' })).toBeVisible();
    await uploadFile(page, 'invoice-en.pdf');
    await expect(page.getByRole('heading', { name: 'Podsumowanie' })).toBeVisible();

    const history = page.getByRole('region', { name: 'Historia analiz' });
    await expect(history.getByRole('listitem')).toHaveCount(2);
    await history
      .getByRole('button', { name: /^Usuń z historii/ })
      .first()
      .click();
    await expect(history.getByRole('listitem')).toHaveCount(1);
    await history.getByRole('button', { name: 'Wyczyść' }).click();
    await expect(history.getByText('Tutaj pojawią się ostatnie wyniki')).toBeVisible();
  });
});

test.describe('accessibility and responsive layout', () => {
  test('the whole flow works with the keyboard only', async ({ page }) => {
    await mockApi(page, ok());
    await page.goto('./');

    await page.keyboard.press('Tab');
    const input = page.locator('input[type="file"]');
    await expect(input).toBeFocused();
    const chooser = page.waitForEvent('filechooser');
    await page.keyboard.press('Enter');
    await (await chooser).setFiles(fixture('contract-pl.pdf'));

    await expect(page.getByRole('heading', { name: 'Podsumowanie' })).toBeVisible();
    const download = page.getByRole('button', { name: /^Pobierz / });
    for (
      let step = 0;
      step < 15 && !(await download.evaluate((el) => el === document.activeElement));
      step += 1
    ) {
      await page.keyboard.press('Tab');
    }
    await expect(download).toBeFocused();
  });

  test('has no horizontal scrolling at 360 px', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await mockApi(page, ok());
    await page.goto('./');
    await uploadFile(page, 'contract-pl.pdf');
    await expect(page.getByRole('heading', { name: 'Podsumowanie' })).toBeVisible();
    await page.getByText('Pokaż podgląd JSON').click();

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test('empty state has no serious accessibility violations', async ({ page }) => {
    await page.goto('./');
    await expectNoSeriousA11yViolations(page);
  });

  test('result view has no serious accessibility violations', async ({ page }) => {
    await mockApi(page, ok());
    await page.goto('./');
    await uploadFile(page, 'contract-pl.pdf');
    await expect(page.getByRole('heading', { name: 'Podsumowanie' })).toBeVisible();
    await page.getByText('Pokaż podgląd JSON').click();
    await expectNoSeriousA11yViolations(page);
  });

  test('error state has no serious accessibility violations', async ({ page }) => {
    await mockApi(page, apiError(503, 'AI_UNAVAILABLE'));
    await page.goto('./');
    await uploadFile(page, 'contract-pl.pdf');
    await expect(page.getByRole('alert')).toBeVisible();
    await expectNoSeriousA11yViolations(page);
  });

  for (const scheme of ['light', 'dark'] as const) {
    test(`colour contrast passes in ${scheme} mode`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await mockApi(page, ok());
      await page.goto('./');
      await uploadFile(page, 'contract-pl.pdf');
      await expect(page.getByRole('heading', { name: 'Podsumowanie' })).toBeVisible();
      const results = await new AxeBuilder({ page }).withRules(['color-contrast']).analyze();
      expect(results.violations).toEqual([]);
    });
  }
});

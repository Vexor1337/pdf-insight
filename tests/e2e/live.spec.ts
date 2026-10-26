import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { AnalysisResultSchema } from '../../shared/schema.ts';
import { uploadFile } from './support/files.ts';

const DEFINITION_OF_DONE_MS = 30_000;

test.describe('@live production demo', () => {
  test.skip(!process.env.E2E_BASE_URL, 'E2E_BASE_URL is not set');
  test.describe.configure({ mode: 'serial', retries: 0 });

  test('loads from the GitHub Pages base path without failed requests', async ({ page }) => {
    const failed: string[] = [];
    page.on('response', (response) => {
      if (response.status() >= 400) failed.push(`${String(response.status())} ${response.url()}`);
    });
    await page.goto('./');
    await expect(page.getByRole('heading', { level: 1, name: 'PDF Insight' })).toBeVisible();
    expect(failed).toEqual([]);
  });

  test('analyses a PDF end to end in under 30 seconds', async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto('./');
    const started = Date.now();
    await uploadFile(page, 'contract-pl.pdf');
    await expect(page.getByRole('heading', { name: 'Podsumowanie' })).toBeVisible({
      timeout: DEFINITION_OF_DONE_MS,
    });
    expect(Date.now() - started).toBeLessThan(DEFINITION_OF_DONE_MS);

    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: /^Pobierz / }).click();
    const json: unknown = JSON.parse(readFileSync(await (await download).path(), 'utf8'));
    expect(AnalysisResultSchema.safeParse(json).success).toBe(true);
  });

  test('handles the recruitment contract: injection ignored, scanned annex read', async ({
    page,
  }) => {
    const testPdf = process.env.TEST_PDF;
    test.skip(!testPdf, 'TEST_PDF is not set');
    test.setTimeout(90_000);
    await page.goto('./');
    await page.locator('input[type="file"]').setInputFiles(testPdf ?? '');
    await expect(page.getByRole('heading', { name: 'Podsumowanie' })).toBeVisible({
      timeout: DEFINITION_OF_DONE_MS,
    });

    const result = page.getByRole('article', { name: 'Wynik analizy' });
    await expect(result.locator('.summary')).not.toContainText(/nieważn|1 PLN/i);
    await expect(page.getByTestId('warnings')).toContainText('Strona 4');
    await expect(page.getByTestId('warnings')).toContainText('OCR');
    await expect(result).toContainText('13');
    await expect(result).toContainText('12.03.2026');
  });
});

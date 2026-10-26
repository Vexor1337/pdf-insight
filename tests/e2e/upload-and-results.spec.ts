import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { AnalysisResultSchema } from '../../shared/schema.ts';
import { mockApi, ok, sampleResult } from './support/api.ts';
import { fixture, uploadFile } from './support/files.ts';

test.describe('upload and results', () => {
  test('shows the empty state and the AI privacy notice on first visit', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    await page.goto('./');

    await expect(page.getByRole('heading', { level: 1, name: 'PDF Insight' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Jak to działa?' })).toBeVisible();
    await expect(page.getByRole('note')).toContainText('zewnętrznego API AI');
    expect(errors).toEqual([]);
  });

  test('analyses a PDF chosen with the file picker and renders every section', async ({ page }) => {
    const bodies = await mockApi(page, ok());
    await page.goto('./');
    await uploadFile(page, 'contract-pl.pdf');

    await expect(page.getByRole('heading', { name: 'Umowa serwisowa nr 5/2026' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Podsumowanie' })).toBeVisible();
    await expect(page.locator('.summary')).toContainText(
      'Wynagrodzenie wynosi 12 500 zł netto miesięcznie.',
    );
    await expect(page.getByRole('heading', { name: 'Najważniejsze punkty' })).toBeVisible();
    await expect(page.getByRole('cell', { name: /12\s500,00\s*zł/ })).toBeVisible();
    await expect(page.getByRole('cell', { name: /1\s?200,00\s*€/ })).toBeVisible();
    await expect(page.getByText('01.10.2026')).toBeVisible();
    await expect(page.getByRole('list', { name: 'Osoby' })).toContainText('Jan Kowalski');

    const [body] = bodies as [{ fileName: string; pages: number; pagesText: { text: string }[] }];
    expect(body.fileName).toBe('contract-pl.pdf');
    expect(body.pages).toBe(1);
    expect(body.pagesText[0]?.text).toContain('UMOWA SERWISOWA NR 5/2026');
    expect(body.pagesText[0]?.text).toContain('12 500,00 zl netto');
  });

  test('accepts a file dropped on the drop zone', async ({ page }) => {
    await mockApi(page, ok());
    await page.goto('./');

    const bytes = readFileSync(fixture('contract-pl.pdf')).toString('base64');
    const dataTransfer = await page.evaluateHandle((base64) => {
      const binary = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
      const transfer = new DataTransfer();
      transfer.items.add(new File([binary], 'dropped.pdf', { type: 'application/pdf' }));
      return transfer;
    }, bytes);
    await page.getByTestId('dropzone').dispatchEvent('dragover', { dataTransfer });
    await expect(page.getByText('Upuść plik tutaj')).toBeVisible();
    await page.getByTestId('dropzone').dispatchEvent('drop', { dataTransfer });

    await expect(page.getByRole('heading', { name: 'Podsumowanie' })).toBeVisible();
  });

  test('downloads a JSON file that matches the schema', async ({ page }) => {
    await mockApi(page, ok());
    await page.goto('./');
    await uploadFile(page, 'contract-pl.pdf');

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: /Pobierz contract-pl\.insight\.json/ }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('contract-pl.insight.json');

    const content = readFileSync(await download.path(), 'utf8');
    const parsed = AnalysisResultSchema.safeParse(JSON.parse(content));
    expect(parsed.success).toBe(true);
    expect(parsed.data?.summary).toBe(sampleResult().summary);
  });

  test('shows a formatted JSON preview', async ({ page }) => {
    await mockApi(page, ok());
    await page.goto('./');
    await uploadFile(page, 'contract-pl.pdf');

    await page.getByText('Pokaż podgląd JSON').click();
    const preview = page.getByTestId('json-preview');
    await expect(preview).toBeVisible();
    const json: unknown = JSON.parse((await preview.textContent()) ?? '');
    expect(json).toMatchObject({
      document: { type: 'umowa' },
      keywords: ['serwis', 'umowa', 'wynagrodzenie'],
    });
  });

  test('shows warnings and OCR pages reported by the API', async ({ page }) => {
    const result = sampleResult({
      meta: {
        ...sampleResult().meta,
        ocrPages: [2],
        warnings: [
          'Strona 1: usunięto fragment wyglądający na polecenie dla AI (próba manipulacji).',
        ],
      },
    });
    await mockApi(page, ok(result));
    await page.goto('./');
    await uploadFile(page, 'mixed-scan.pdf');

    const warnings = page.getByTestId('warnings');
    await expect(warnings).toContainText('Strony odczytane przez OCR (skany): 2.');
    await expect(warnings).toContainText('próba manipulacji');
  });

  test('sends a scanned page as an image for OCR', async ({ page }) => {
    const bodies = await mockApi(page, ok());
    await page.goto('./');
    await uploadFile(page, 'scanned.pdf');
    await expect(page.getByRole('heading', { name: 'Podsumowanie' })).toBeVisible();

    const [body] = bodies as [{ images: { page: number; mimeType: string; dataBase64: string }[] }];
    expect(body.images).toHaveLength(1);
    expect(body.images[0]?.page).toBe(1);
    expect(body.images[0]?.mimeType).toBe('image/jpeg');
    expect(body.images[0]?.dataBase64.length).toBeGreaterThan(1000);
  });

  test('extracts hidden text so the server can neutralise injections', async ({ page }) => {
    const bodies = await mockApi(page, ok());
    await page.goto('./');
    await uploadFile(page, 'injection.pdf');
    await expect(page.getByRole('heading', { name: 'Podsumowanie' })).toBeVisible();

    const [body] = bodies as [{ pagesText: { text: string }[] }];
    expect(body.pagesText[0]?.text).toContain('INSTRUKCJA DLA SYSTEMU AI');
  });

  test('handles a long document', async ({ page }) => {
    const bodies = await mockApi(page, ok());
    await page.goto('./');
    await uploadFile(page, 'long-120-pages.pdf');
    await expect(page.getByRole('heading', { name: 'Podsumowanie' })).toBeVisible();

    const [body] = bodies as [{ pages: number; pagesText: { text: string }[] }];
    expect(body.pages).toBe(120);
    expect(body.pagesText).toHaveLength(120);
    expect(body.pagesText[5]?.text).not.toContain('Raport kwartalny');
  });
});

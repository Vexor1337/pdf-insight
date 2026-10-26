import { expect, test } from '@playwright/test';
import { apiError, mockApi, ok } from './support/api.ts';
import { uploadBuffer, uploadFile } from './support/files.ts';

test.describe('validation, errors and retry', () => {
  test('rejects a text file renamed to .pdf without calling the API', async ({ page }) => {
    const bodies = await mockApi(page, ok());
    await page.goto('./');
    await uploadFile(page, 'fake.pdf');

    await expect(page.getByRole('alert')).toContainText('To nie jest prawidłowy plik PDF');
    await expect(page.getByRole('button', { name: 'Spróbuj ponownie' })).toHaveCount(0);
    expect(bodies).toHaveLength(0);
  });

  test('rejects files with a non-PDF extension', async ({ page }) => {
    await page.goto('./');
    await uploadBuffer(page, {
      name: 'notatka.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('abc'),
    });
    await expect(page.getByRole('alert')).toContainText('To nie jest prawidłowy plik PDF');
  });

  test('rejects files larger than 10 MB without calling the API', async ({ page }) => {
    const bodies = await mockApi(page, ok());
    await page.goto('./');
    const buffer = Buffer.concat([Buffer.from('%PDF-1.7\n'), Buffer.alloc(10 * 1024 * 1024)]);
    await uploadBuffer(page, { name: 'duzy.pdf', mimeType: 'application/pdf', buffer });

    await expect(page.getByRole('alert')).toContainText('Plik jest za duży');
    expect(bodies).toHaveLength(0);
  });

  test('rejects an empty file', async ({ page }) => {
    await page.goto('./');
    await uploadBuffer(page, {
      name: 'pusty.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.alloc(0),
    });
    await expect(page.getByRole('alert')).toContainText('Plik jest pusty');
  });

  const fileErrors = [
    ['encrypted.pdf', 'zabezpieczony hasłem'],
    ['corrupted.pdf', 'może być uszkodzony'],
    ['empty.pdf', 'Nie znaleziono w dokumencie tekstu'],
  ] as const;
  for (const [file, message] of fileErrors) {
    test(`explains why ${file} cannot be analysed`, async ({ page }) => {
      const bodies = await mockApi(page, ok());
      await page.goto('./');
      await uploadFile(page, file);
      await expect(page.getByRole('alert')).toContainText(message);
      expect(bodies).toHaveLength(0);
    });
  }

  test('shows an error with retry, and retry succeeds without re-reading the file', async ({
    page,
  }) => {
    let calls = 0;
    const bodies = await mockApi(page, () => {
      calls += 1;
      return calls === 1 ? apiError(503, 'AI_UNAVAILABLE')() : ok()();
    });
    await page.goto('./');
    await uploadFile(page, 'contract-pl.pdf');

    await expect(page.getByRole('alert')).toContainText('Usługa AI jest chwilowo niedostępna');
    await page.getByRole('button', { name: 'Spróbuj ponownie' }).click();
    await expect(page.getByRole('heading', { name: 'Podsumowanie' })).toBeVisible();
    expect(bodies).toHaveLength(2);
    expect(bodies[1]).toEqual(bodies[0]);
  });

  test('shows the rate-limit message with the waiting time', async ({ page }) => {
    await mockApi(page, apiError(429, 'RATE_LIMITED', { 'Retry-After': '42' }));
    await page.goto('./');
    await uploadFile(page, 'contract-pl.pdf');
    await expect(page.getByRole('alert')).toContainText('Spróbuj ponownie za 42 s');
  });

  test('never displays a response that does not match the schema', async ({ page }) => {
    await mockApi(page, () => ({
      status: 200,
      body: { result: { summary: 'Tylko jedno zdanie.', keyPoints: [] } },
    }));
    await page.goto('./');
    await uploadFile(page, 'contract-pl.pdf');

    await expect(page.getByRole('alert')).toContainText('nieprawidłowym formacie');
    await expect(page.getByText('Tylko jedno zdanie.')).toHaveCount(0);
  });

  test('reports a network failure', async ({ page }) => {
    await page.route('**/api/analyze', (route) => route.abort('internetdisconnected'));
    await page.goto('./');
    await uploadFile(page, 'contract-pl.pdf');
    await expect(page.getByRole('alert')).toContainText('Brak połączenia z serwerem analizy');
  });

  test('"Wybierz inny plik" returns to the empty state', async ({ page }) => {
    await page.goto('./');
    await uploadFile(page, 'fake.pdf');
    await page.getByRole('button', { name: 'Wybierz inny plik' }).click();
    await expect(page.getByRole('heading', { name: 'Jak to działa?' })).toBeVisible();
  });

  test('shows loading stages while the analysis is running', async ({ page }) => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route('**/api/analyze', async (route) => {
      await gate;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(ok()().body),
      });
    });
    await page.goto('./');
    await uploadFile(page, 'contract-pl.pdf');

    await expect(page.getByRole('status').filter({ hasText: 'Analizuję dokument' })).toBeVisible();
    await expect(page.locator('[aria-busy="true"]')).toBeVisible();
    release();
    await expect(page.getByRole('heading', { name: 'Podsumowanie' })).toBeVisible();
  });
});

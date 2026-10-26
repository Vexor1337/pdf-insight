import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { mockApi, ok, sampleResult } from './support/api.ts';
import { fixture, uploadBuffer, uploadFile } from './support/files.ts';

const XSS_TITLE = '<img src=x onerror="window.__xss=1">';
const XSS_PAYLOADS = [
  XSS_TITLE,
  '<script>window.__xss=1</script>',
  'javascript:window.__xss=1',
  '<svg onload="window.__xss=1"></svg>',
];

test.describe('security', () => {
  test('renders malicious AI output as inert text', async ({ page }) => {
    const base = sampleResult();
    const result = sampleResult({
      document: { ...base.document, title: XSS_TITLE },
      keyPoints: [...XSS_PAYLOADS.slice(1), 'Punkt kontrolny'],
      keywords: XSS_PAYLOADS,
      entities: { organizations: XSS_PAYLOADS, people: [] },
      amounts: [{ value: 1, currency: 'PLN', context: XSS_PAYLOADS[3] ?? '' }],
    });
    await mockApi(page, ok(result));
    await page.goto('./');
    await uploadFile(page, 'contract-pl.pdf');

    await expect(page.getByRole('heading', { name: XSS_TITLE })).toBeVisible();
    await expect(page.getByText('Punkt kontrolny', { exact: true })).toBeVisible();
    expect(await page.evaluate(() => (window as { __xss?: number }).__xss)).toBeUndefined();
    await expect(page.locator('main img, main script, main svg[onload]')).toHaveCount(0);
    await expect(page.locator('a[href^="javascript:"]')).toHaveCount(0);
  });

  test('shows a malicious file name as text and downloads under a safe name', async ({ page }) => {
    const evilName = `<img src=x onerror=alert(1)>${String.fromCodePoint(0x202e)}fdp.exe.pdf`;
    const result = sampleResult({ document: { ...sampleResult().document, fileName: evilName } });
    await mockApi(page, ok(result));
    await page.goto('./');
    await uploadBuffer(page, {
      name: evilName,
      mimeType: 'application/pdf',
      buffer: readFileSync(fixture('contract-pl.pdf')),
    });

    await expect(page.getByRole('heading', { name: 'Podsumowanie' })).toBeVisible();
    await expect(page.locator('main img')).toHaveCount(0);
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: /^Pobierz / }).click();
    const name = (await downloadPromise).suggestedFilename();
    expect(name).toMatch(/^[\p{L}\p{N}_-]+\.insight\.json$/u);
    expect(name).not.toContain('<');
  });

  test('ignores tampered or malformed history in localStorage', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem(
        'pdf-insight:history:v1',
        JSON.stringify([
          { id: 'x', savedAt: 'nie-data', result: { summary: '<img src=x onerror=alert(1)>' } },
          'garbage',
        ]),
      );
    });
    await page.goto('./');
    await expect(page.getByText('Tutaj pojawią się ostatnie wyniki')).toBeVisible();
    await expect(page.locator('main img')).toHaveCount(0);
  });

  test('works when localStorage is unavailable', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', {
        get() {
          throw new Error('blocked');
        },
      });
    });
    await mockApi(page, ok());
    await page.goto('./');
    await uploadFile(page, 'contract-pl.pdf');
    await expect(page.getByRole('heading', { name: 'Podsumowanie' })).toBeVisible();
  });

  test('ships a Content-Security-Policy without inline scripts', async ({ page }) => {
    await page.goto('./');
    const csp = await page
      .locator('meta[http-equiv="Content-Security-Policy"]')
      .getAttribute('content');
    expect(csp).toContain("script-src 'self'");
    expect(csp).not.toContain('unsafe-inline');
    expect(csp).toContain("object-src 'none'");
  });

  test('loads the pdf.js worker from the GitHub Pages base path without CSP violations', async ({
    page,
  }) => {
    const violations: string[] = [];
    page.on('console', (message) => {
      if (/Content Security Policy|Refused to/i.test(message.text()))
        violations.push(message.text());
    });
    const workerRequests: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('pdf.worker'))
        workerRequests.push(new URL(request.url()).pathname);
    });
    await mockApi(page, ok());
    await page.goto('./');
    await uploadFile(page, 'scanned.pdf');
    await expect(page.getByRole('heading', { name: 'Podsumowanie' })).toBeVisible();

    expect(workerRequests.every((path) => path.startsWith('/pdf-insight/'))).toBe(true);
    expect(violations).toEqual([]);
  });
});

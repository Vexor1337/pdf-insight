import { join } from 'node:path';
import type { Page } from '@playwright/test';

export const FIXTURES = join(import.meta.dirname, '..', '..', 'fixtures', 'pdfs');

export function fixture(name: string): string {
  return join(FIXTURES, name);
}

export async function uploadFile(page: Page, name: string): Promise<void> {
  await page.locator('input[type="file"]').setInputFiles(fixture(name));
}

export async function uploadBuffer(
  page: Page,
  file: { name: string; mimeType: string; buffer: Buffer },
): Promise<void> {
  await page.locator('input[type="file"]').setInputFiles(file);
}

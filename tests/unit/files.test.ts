import { describe, expect, it } from 'vitest';
import { MAX_FILE_BYTES } from '../../shared/limits.ts';
import { safeDownloadName } from '../../src/lib/download.ts';
import { validatePdfFile } from '../../src/lib/validateFile.ts';

const pdfFile = (name: string, content: BlobPart = '%PDF-1.7\n...', type = 'application/pdf') =>
  new File([content], name, { type });

async function errorCode(files: File[]): Promise<string | null> {
  try {
    await validatePdfFile(files);
    return null;
  } catch (error) {
    return (error as { code: string }).code;
  }
}

describe('validatePdfFile', () => {
  it('accepts a real PDF', async () => {
    expect(await errorCode([pdfFile('umowa.PDF')])).toBeNull();
  });

  it('accepts a PDF header preceded by junk bytes', async () => {
    expect(await errorCode([pdfFile('a.pdf', `${'x'.repeat(100)}%PDF-1.4`)])).toBeNull();
  });

  it.each([
    ['no file', [], 'NO_FILE'],
    ['two files', [pdfFile('a.pdf'), pdfFile('b.pdf')], 'MULTIPLE_FILES'],
    ['wrong extension', [pdfFile('a.txt')], 'NOT_PDF'],
    ['wrong MIME type', [pdfFile('a.pdf', '%PDF-1.7', 'text/html')], 'NOT_PDF'],
    ['renamed text file', [pdfFile('a.pdf', 'hello world')], 'NOT_PDF'],
    ['empty file', [pdfFile('a.pdf', '')], 'EMPTY_FILE'],
  ])('rejects %s', async (_label, files, code) => {
    expect(await errorCode(files)).toBe(code);
  });

  it('rejects files above 10 MB', async () => {
    const big = pdfFile('a.pdf', new Uint8Array(MAX_FILE_BYTES + 1));
    expect(await errorCode([big])).toBe('FILE_TOO_LARGE');
  });
});

describe('safeDownloadName', () => {
  it.each([
    ['umowa.pdf', 'umowa.insight.json'],
    ['Umowa 14-2026 (final).pdf', 'Umowa-14-2026-final.insight.json'],
    ['../../etc/passwd.pdf', 'etc-passwd.insight.json'],
    [`faktura${String.fromCodePoint(0x202e)}fdp.exe.pdf`, 'fakturafdp-exe.insight.json'],
    ['<img src=x onerror=alert(1)>.pdf', 'img-src-x-onerror-alert-1.insight.json'],
    ['....pdf', 'dokument.insight.json'],
    ['Zażółć gęślą.pdf', 'Zażółć-gęślą.insight.json'],
  ])('%s → %s', (input, expected) => {
    expect(safeDownloadName(input)).toBe(expected);
  });

  it('limits the length of the name', () => {
    expect(safeDownloadName(`${'a'.repeat(500)}.pdf`).length).toBeLessThanOrEqual(
      80 + '.insight.json'.length,
    );
  });
});

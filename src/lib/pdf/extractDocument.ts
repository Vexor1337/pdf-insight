import type { PDFDocumentProxy } from 'pdfjs-dist';
import { MAX_OCR_PAGES, MAX_TEXT_CHARS, OCR_MIN_TEXT_CHARS } from '../../../shared/limits.ts';
import type { AnalyzeRequest } from '../../../shared/api.ts';
import { AppError } from '../errors.ts';
import { loadPdf } from './loadPdf.ts';
import { pageHasImages, renderPageAsJpeg } from './renderPageImage.ts';
import { joinFragments, stripRepeatedLines, type PageText } from './textLayout.ts';

export type ExtractionStage = 'reading' | 'ocr';

interface ExtractOptions {
  signal: AbortSignal;
  onStage: (stage: ExtractionStage) => void;
}

function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
}

async function readPagesText(pdf: PDFDocumentProxy, signal: AbortSignal): Promise<PageText[]> {
  const pages: PageText[] = [];
  let totalChars = 0;
  for (let number = 1; number <= pdf.numPages && totalChars < MAX_TEXT_CHARS; number += 1) {
    throwIfAborted(signal);
    const page = await pdf.getPage(number);
    const content = await page.getTextContent();
    const fragments = content.items.flatMap((item) => ('str' in item ? [item] : []));
    const text = joinFragments(fragments).slice(0, MAX_TEXT_CHARS - totalChars);
    totalChars += text.length;
    pages.push({ page: number, text });
    page.cleanup();
  }
  return stripRepeatedLines(pages);
}

async function renderScannedPages(
  pdf: PDFDocumentProxy,
  pages: readonly PageText[],
  signal: AbortSignal,
): Promise<AnalyzeRequest['images']> {
  const candidates = pages.filter((page) => page.text.length < OCR_MIN_TEXT_CHARS);
  const images: AnalyzeRequest['images'] = [];
  for (const { page: number } of candidates) {
    if (images.length >= MAX_OCR_PAGES) break;
    throwIfAborted(signal);
    const page = await pdf.getPage(number);
    if (await pageHasImages(page)) {
      const dataBase64 = await renderPageAsJpeg(page);
      if (dataBase64) images.push({ page: number, mimeType: 'image/jpeg', dataBase64 });
    }
    page.cleanup();
  }
  return images;
}

export async function extractDocument(
  file: File,
  options: ExtractOptions,
): Promise<AnalyzeRequest> {
  const { signal, onStage } = options;
  onStage('reading');
  const { pdf, close } = await loadPdf(await file.arrayBuffer());
  try {
    const pagesText = await readPagesText(pdf, signal);
    const needsOcr = pagesText.some((page) => page.text.length < OCR_MIN_TEXT_CHARS);
    if (needsOcr) onStage('ocr');
    const images = needsOcr ? await renderScannedPages(pdf, pagesText, signal) : [];

    const hasText = pagesText.some((page) => page.text.trim() !== '');
    if (!hasText && images.length === 0) throw new AppError('PDF_NO_CONTENT');

    return {
      fileName: file.name,
      pages: pdf.numPages,
      pagesText,
      images,
    };
  } finally {
    await close();
  }
}

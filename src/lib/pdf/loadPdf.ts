import {
  getDocument,
  GlobalWorkerOptions,
  PasswordException,
  type PDFDocumentProxy,
} from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { MAX_PAGES } from '../../../shared/limits.ts';
import { AppError } from '../errors.ts';

GlobalWorkerOptions.workerSrc = workerUrl;

const ASSETS = `${import.meta.env.BASE_URL}pdfjs/`;
const MAX_IMAGE_PIXELS = 40_000_000;

export interface OpenedPdf {
  pdf: PDFDocumentProxy;
  /** Releases the parser worker and all memory held for the document. */
  close: () => Promise<void>;
}

export async function loadPdf(data: ArrayBuffer): Promise<OpenedPdf> {
  const task = getDocument({
    data: new Uint8Array(data),
    enableXfa: false,
    disableAutoFetch: true,
    disableStream: true,
    maxImageSize: MAX_IMAGE_PIXELS,
    cMapUrl: `${ASSETS}cmaps/`,
    cMapPacked: true,
    standardFontDataUrl: `${ASSETS}standard_fonts/`,
    wasmUrl: `${ASSETS}wasm/`,
    iccUrl: `${ASSETS}iccs/`,
  });

  const close = () => task.destroy();
  let pdf: PDFDocumentProxy;
  try {
    pdf = await task.promise;
  } catch (error) {
    await close();
    const code = error instanceof PasswordException ? 'PDF_ENCRYPTED' : 'PDF_CORRUPTED';
    throw new AppError(code, { cause: error });
  }

  if (pdf.numPages > MAX_PAGES) {
    await close();
    throw new AppError('PDF_TOO_MANY_PAGES');
  }
  return { pdf, close };
}

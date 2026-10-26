import { MAX_FILE_BYTES } from '../../shared/limits.ts';
import { AppError } from './errors.ts';

const PDF_SIGNATURE = '%PDF-';
const SIGNATURE_SEARCH_BYTES = 1024;
const ACCEPTED_MIME_TYPES = new Set(['application/pdf', 'application/x-pdf', '']);

async function hasPdfSignature(file: Blob): Promise<boolean> {
  const head = new Uint8Array(await file.slice(0, SIGNATURE_SEARCH_BYTES).arrayBuffer());
  const text = new TextDecoder('latin1').decode(head);
  return text.includes(PDF_SIGNATURE);
}

export async function validatePdfFile(files: readonly File[]): Promise<File> {
  if (files.length === 0) throw new AppError('NO_FILE');
  if (files.length > 1) throw new AppError('MULTIPLE_FILES');

  const file = files[0];
  if (!file) throw new AppError('NO_FILE');
  if (!file.name.toLowerCase().endsWith('.pdf') || !ACCEPTED_MIME_TYPES.has(file.type)) {
    throw new AppError('NOT_PDF');
  }
  if (file.size === 0) throw new AppError('EMPTY_FILE');
  if (file.size > MAX_FILE_BYTES) throw new AppError('FILE_TOO_LARGE');
  if (!(await hasPdfSignature(file))) throw new AppError('NOT_PDF');

  return file;
}

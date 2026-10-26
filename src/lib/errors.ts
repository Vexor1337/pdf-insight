import type { ApiErrorCode } from '../../shared/api.ts';

export type FileErrorCode =
  | 'NO_FILE'
  | 'MULTIPLE_FILES'
  | 'NOT_PDF'
  | 'EMPTY_FILE'
  | 'FILE_TOO_LARGE'
  | 'PDF_ENCRYPTED'
  | 'PDF_CORRUPTED'
  | 'PDF_TOO_MANY_PAGES'
  | 'PDF_NO_CONTENT';

export type ClientErrorCode = 'NETWORK' | 'TIMEOUT' | 'INVALID_RESPONSE' | 'CONFIG';

export type AppErrorCode = FileErrorCode | ClientErrorCode | ApiErrorCode;

const FILE_ERROR_CODES = new Set<AppErrorCode>([
  'NO_FILE',
  'MULTIPLE_FILES',
  'NOT_PDF',
  'EMPTY_FILE',
  'FILE_TOO_LARGE',
  'PDF_ENCRYPTED',
  'PDF_CORRUPTED',
  'PDF_TOO_MANY_PAGES',
  'PDF_NO_CONTENT',
]);

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly retryAfterSeconds: number | undefined;

  constructor(code: AppErrorCode, options: { retryAfterSeconds?: number; cause?: unknown } = {}) {
    super(code, { cause: options.cause });
    this.name = 'AppError';
    this.code = code;
    this.retryAfterSeconds = options.retryAfterSeconds;
  }
}

export function toAppError(error: unknown): AppError {
  return error instanceof AppError ? error : new AppError('INTERNAL', { cause: error });
}

export function isFileError(error: AppError): boolean {
  return FILE_ERROR_CODES.has(error.code);
}

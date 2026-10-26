import type { ApiErrorCode } from '../../shared/api.ts';

export class ServiceError extends Error {
  readonly code: ApiErrorCode;

  constructor(code: ApiErrorCode, options: { cause?: unknown } = {}) {
    super(code, options);
    this.name = 'ServiceError';
    this.code = code;
  }
}

import { AnalyzeSuccessSchema, ApiErrorSchema, type AnalyzeRequest } from '../../shared/api.ts';
import type { AnalysisResult } from '../../shared/schema.ts';
import { AppError } from '../lib/errors.ts';

const CLIENT_TIMEOUT_MS = 90_000;

interface ClientOptions {
  apiUrl: string | undefined;
  signal: AbortSignal;
  fetchFn?: typeof fetch;
}

async function readError(response: Response): Promise<AppError> {
  const retryAfter = Number(response.headers.get('Retry-After'));
  const retryAfterSeconds = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : undefined;
  const body = ApiErrorSchema.safeParse(await response.json().catch(() => null));
  const code = body.success ? body.data.error.code : 'INTERNAL';
  return new AppError(code, retryAfterSeconds === undefined ? {} : { retryAfterSeconds });
}

export async function requestAnalysis(
  payload: AnalyzeRequest,
  { apiUrl, signal, fetchFn = fetch }: ClientOptions,
): Promise<AnalysisResult> {
  if (!apiUrl) throw new AppError('CONFIG');

  const timeout = AbortSignal.timeout(CLIENT_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetchFn(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.any([signal, timeout]),
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
    });
  } catch (error) {
    if (signal.aborted) throw error;
    throw new AppError(timeout.aborted ? 'TIMEOUT' : 'NETWORK', { cause: error });
  }

  if (!response.ok) throw await readError(response);

  const body = AnalyzeSuccessSchema.safeParse(await response.json().catch(() => null));
  if (!body.success) throw new AppError('INVALID_RESPONSE', { cause: body.error });
  return body.data.result;
}

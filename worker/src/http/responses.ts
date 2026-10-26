import type { ApiErrorCode } from '../../../shared/api.ts';

const BASE_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
} as const;

const STATUS_BY_CODE: Record<ApiErrorCode, number> = {
  BAD_REQUEST: 400,
  FORBIDDEN_ORIGIN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  PAYLOAD_TOO_LARGE: 413,
  UNSUPPORTED_MEDIA_TYPE: 415,
  RATE_LIMITED: 429,
  AI_INVALID_RESPONSE: 502,
  AI_UNAVAILABLE: 503,
  AI_TIMEOUT: 504,
  INTERNAL: 500,
};

const MESSAGES: Record<ApiErrorCode, string> = {
  BAD_REQUEST: 'Nieprawidłowe dane żądania.',
  FORBIDDEN_ORIGIN: 'Brak dostępu z tej domeny.',
  NOT_FOUND: 'Nie znaleziono.',
  METHOD_NOT_ALLOWED: 'Niedozwolona metoda.',
  PAYLOAD_TOO_LARGE: 'Żądanie jest zbyt duże.',
  UNSUPPORTED_MEDIA_TYPE: 'Wymagany jest format JSON.',
  RATE_LIMITED: 'Zbyt wiele żądań. Spróbuj ponownie za chwilę.',
  AI_INVALID_RESPONSE: 'Model AI zwrócił niepoprawny wynik.',
  AI_UNAVAILABLE: 'Usługa AI jest chwilowo niedostępna.',
  AI_TIMEOUT: 'Model AI nie odpowiedział na czas.',
  INTERNAL: 'Wystąpił błąd serwera.',
};

export function jsonResponse(
  body: unknown,
  status = 200,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...BASE_HEADERS, ...headers } });
}

export function errorResponse(code: ApiErrorCode, headers: Record<string, string> = {}): Response {
  return jsonResponse({ error: { code, message: MESSAGES[code] } }, STATUS_BY_CODE[code], headers);
}

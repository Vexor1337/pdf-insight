import { MAX_FILE_BYTES, MAX_PAGES } from '../../shared/limits.ts';
import type { AppError, AppErrorCode } from '../lib/errors.ts';

const MAX_MB = MAX_FILE_BYTES / (1024 * 1024);

const ERROR_MESSAGES: Record<AppErrorCode, string> = {
  NO_FILE: 'Nie wybrano pliku.',
  MULTIPLE_FILES: 'Wgraj jeden plik PDF naraz.',
  NOT_PDF: 'To nie jest prawidłowy plik PDF. Wybierz plik z rozszerzeniem .pdf.',
  EMPTY_FILE: 'Plik jest pusty.',
  FILE_TOO_LARGE: `Plik jest za duży. Maksymalny rozmiar to ${MAX_MB} MB.`,
  PDF_ENCRYPTED: 'Plik PDF jest zabezpieczony hasłem. Usuń zabezpieczenie i spróbuj ponownie.',
  PDF_CORRUPTED: 'Nie udało się odczytać pliku PDF — plik może być uszkodzony.',
  PDF_TOO_MANY_PAGES: `Dokument ma zbyt wiele stron (maksymalnie ${MAX_PAGES}).`,
  PDF_NO_CONTENT: 'Nie znaleziono w dokumencie tekstu ani stron do odczytu.',
  NETWORK: 'Brak połączenia z serwerem analizy. Sprawdź internet i spróbuj ponownie.',
  TIMEOUT: 'Analiza trwała zbyt długo. Spróbuj ponownie.',
  INVALID_RESPONSE: 'Serwer zwrócił wynik w nieprawidłowym formacie. Spróbuj ponownie.',
  CONFIG: 'Aplikacja nie ma skonfigurowanego adresu API.',
  BAD_REQUEST: 'Nie udało się przetworzyć dokumentu.',
  FORBIDDEN_ORIGIN: 'Ta strona nie ma dostępu do serwera analizy.',
  NOT_FOUND: 'Nie znaleziono usługi analizy.',
  METHOD_NOT_ALLOWED: 'Nieprawidłowe żądanie.',
  PAYLOAD_TOO_LARGE: 'Dokument jest zbyt duży do analizy.',
  UNSUPPORTED_MEDIA_TYPE: 'Nieprawidłowe żądanie.',
  RATE_LIMITED: 'Zbyt wiele analiz w krótkim czasie.',
  AI_INVALID_RESPONSE: 'Model AI zwrócił niepoprawny wynik mimo ponownej próby. Spróbuj ponownie.',
  AI_UNAVAILABLE: 'Usługa AI jest chwilowo niedostępna. Spróbuj za chwilę.',
  AI_TIMEOUT: 'Model AI nie odpowiedział na czas. Spróbuj ponownie.',
  INTERNAL: 'Wystąpił nieoczekiwany błąd. Spróbuj ponownie.',
};

export function errorMessage(error: AppError): string {
  const base = ERROR_MESSAGES[error.code];
  if (error.code === 'RATE_LIMITED' && error.retryAfterSeconds !== undefined) {
    return `${base} Spróbuj ponownie za ${error.retryAfterSeconds} s.`;
  }
  return base;
}

export const STAGE_LABELS = {
  reading: 'Odczytuję tekst z PDF…',
  ocr: 'Przygotowuję zeskanowane strony do odczytu…',
  analyzing: 'Analizuję dokument z pomocą AI…',
} as const;

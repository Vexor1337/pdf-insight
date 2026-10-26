import type { ModelAnalysis } from './modelOutput.ts';

const MONTHS: Record<string, number> = {
  stycznia: 1,
  styczeń: 1,
  styczen: 1,
  january: 1,
  jan: 1,
  lutego: 2,
  luty: 2,
  february: 2,
  feb: 2,
  marca: 3,
  marzec: 3,
  march: 3,
  mar: 3,
  kwietnia: 4,
  kwiecień: 4,
  kwiecien: 4,
  april: 4,
  apr: 4,
  maja: 5,
  maj: 5,
  may: 5,
  czerwca: 6,
  czerwiec: 6,
  june: 6,
  jun: 6,
  lipca: 7,
  lipiec: 7,
  july: 7,
  jul: 7,
  sierpnia: 8,
  sierpień: 8,
  sierpien: 8,
  august: 8,
  aug: 8,
  września: 9,
  wrzesień: 9,
  wrzesien: 9,
  september: 9,
  sep: 9,
  sept: 9,
  października: 10,
  październik: 10,
  pazdziernik: 10,
  october: 10,
  oct: 10,
  listopada: 11,
  listopad: 11,
  november: 11,
  nov: 11,
  grudnia: 12,
  grudzień: 12,
  grudzien: 12,
  december: 12,
  dec: 12,
};

const MULTIPLIERS: Record<string, number> = {
  tys: 1e3,
  'tys.': 1e3,
  k: 1e3,
  thousand: 1e3,
  mln: 1e6,
  'mln.': 1e6,
  million: 1e6,
  m: 1e6,
  mld: 1e9,
  'mld.': 1e9,
  billion: 1e9,
  bn: 1e9,
};

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function toIso(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${year}-${pad(month)}-${pad(day)}`;
}

export function findDates(text: string): Set<string> {
  const dates = new Set<string>();
  const add = (iso: string | null) => {
    if (iso) dates.add(iso);
  };
  for (const m of text.matchAll(/(?<!\d)(\d{4})-(\d{1,2})-(\d{1,2})(?!\d)/g)) {
    add(toIso(Number(m[1]), Number(m[2]), Number(m[3])));
  }
  for (const m of text.matchAll(/(?<!\d)(\d{1,2})[./-](\d{1,2})[./-](\d{4})(?!\d)/g)) {
    add(toIso(Number(m[3]), Number(m[2]), Number(m[1])));
  }
  for (const m of text.matchAll(/(?<!\d)(\d{1,2})\.?\s+(\p{L}+)\s+(\d{4})/gu)) {
    const month = MONTHS[(m[2] ?? '').toLowerCase()];
    if (month) add(toIso(Number(m[3]), month, Number(m[1])));
  }
  for (const m of text.matchAll(/(\p{L}+)\s+(\d{1,2}),?\s+(\d{4})/gu)) {
    const month = MONTHS[(m[1] ?? '').toLowerCase()];
    if (month) add(toIso(Number(m[3]), month, Number(m[2])));
  }
  return dates;
}

function parseNumber(raw: string): number | null {
  const compact = raw.replace(/[\s\u00A0]/g, '');
  const lastComma = compact.lastIndexOf(',');
  const lastDot = compact.lastIndexOf('.');
  const decimalSeparator = lastComma > lastDot ? ',' : '.';
  const decimals = compact.length - Math.max(lastComma, lastDot) - 1;
  const hasDecimal = Math.max(lastComma, lastDot) >= 0 && decimals > 0 && decimals <= 2;
  const thousands = decimalSeparator === ',' ? /\./g : /,/g;
  let normalized = compact.replace(thousands, '');
  normalized = hasDecimal
    ? normalized.replace(decimalSeparator, '.')
    : normalized.replace(/[.,]/g, '');
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

const NUMBER_PATTERN =
  /(?<![\d,.])\d{1,3}(?:[ \u00A0.,]\d{3})+(?:[.,]\d{1,2})?(?![\d])|(?<![\d,.])\d+(?:[.,]\d{1,2})?(?![\d])/g;

const CURRENCY_NEARBY = /(zł|pln|eur|€|usd|\$|gbp|£|chf|czk|sek|nok|dkk|złotych)/iu;
const CURRENCY_WINDOW = 8;

export interface FoundNumbers {
  /** Every number in the text. */
  all: Set<number>;
  /** Numbers written directly next to a currency symbol or code. */
  withCurrency: Set<number>;
}

export function findNumbers(text: string): FoundNumbers {
  const found: FoundNumbers = { all: new Set(), withCurrency: new Set() };
  for (const match of text.matchAll(NUMBER_PATTERN)) {
    const value = parseNumber(match[0]);
    if (value === null) continue;
    const end = match.index + match[0].length;
    const after = text.slice(end, end + 12);
    const unit = /^\s*(\p{L}+\.?)/u.exec(after)?.[1]?.toLowerCase();
    const multiplier = unit ? MULTIPLIERS[unit] : undefined;
    const values = multiplier ? [value, value * multiplier] : [value];
    const nearby = text.slice(
      Math.max(0, match.index - CURRENCY_WINDOW),
      end + CURRENCY_WINDOW + 4,
    );
    for (const candidate of values) {
      found.all.add(round(candidate));
      if (CURRENCY_NEARBY.test(nearby)) found.withCurrency.add(round(candidate));
    }
  }
  return found;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

const SMALL_AMOUNT = 1000;

function isAmountGrounded(value: number, numbers: FoundNumbers): boolean {
  const rounded = round(value);
  return value < SMALL_AMOUNT ? numbers.withCurrency.has(rounded) : numbers.all.has(rounded);
}

function stem(token: string): string {
  return token.toLowerCase().slice(0, Math.max(3, Math.min(5, token.length - 2)));
}

function isNameGrounded(name: string, lowerText: string): boolean {
  const tokens = name.split(/[\s.,]+/).filter((token) => token.length >= 3);
  if (tokens.length === 0) return lowerText.includes(name.toLowerCase());
  return tokens.every((token) => lowerText.includes(stem(token)));
}

export interface GroundingResult {
  analysis: ModelAnalysis;
  warnings: string[];
}

export function groundAnalysis(analysis: ModelAnalysis, sourceText: string): GroundingResult {
  const flatText = sourceText.replace(/\s*\n\s*/g, ' ');
  const numbers = findNumbers(flatText);
  const dates = findDates(flatText);
  const lowerText = flatText.toLowerCase();
  const warnings: string[] = [];

  const amounts = analysis.amounts.filter((amount) => isAmountGrounded(amount.value, numbers));
  const dateEntries = analysis.dates.filter((entry) => dates.has(entry.date));
  const people = analysis.entities.people.filter((name) => isNameGrounded(name, lowerText));
  const organizations = analysis.entities.organizations.filter((name) =>
    isNameGrounded(name, lowerText),
  );
  const documentDate =
    analysis.document.date && dates.has(analysis.document.date) ? analysis.document.date : null;

  const removed =
    analysis.amounts.length -
    amounts.length +
    (analysis.dates.length - dateEntries.length) +
    (analysis.entities.people.length - people.length) +
    (analysis.entities.organizations.length - organizations.length) +
    (analysis.document.date !== documentDate ? 1 : 0);
  if (removed > 0) {
    warnings.push(`Pominięto ${removed} wartości, których nie znaleziono w treści dokumentu.`);
  }

  return {
    analysis: {
      ...analysis,
      document: { ...analysis.document, date: documentDate },
      entities: { organizations, people },
      amounts,
      dates: dateEntries,
    },
    warnings,
  };
}

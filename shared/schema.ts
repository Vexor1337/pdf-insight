import { z } from 'zod';
import { isIso4217 } from './currencies.ts';
import {
  KEY_POINTS,
  MAX_AMOUNTS,
  MAX_DATES,
  MAX_ENTITIES,
  MAX_FILE_NAME_CHARS,
  MAX_KEYWORDS,
  MAX_PAGES,
  SUMMARY_SENTENCES,
} from './limits.ts';
import { sanitizeLine } from './sanitize.ts';
import { countSentences } from './sentences.ts';

export const DOCUMENT_TYPES = ['faktura', 'umowa', 'oferta', 'raport', 'inne'] as const;

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isIsoCalendarDate(value: string): boolean {
  const match = ISO_DATE.exec(value);
  if (!match) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

const text = (max: number) => z.string().transform(sanitizeLine).pipe(z.string().min(1).max(max));

const isoDate = z.string().refine(isIsoCalendarDate, 'Data musi mieć format YYYY-MM-DD.');
const languageCode = z.string().regex(/^[a-z]{2}$/, 'Kod języka musi być w formacie ISO 639-1.');
const currencyCode = z.string().refine(isIso4217, 'Waluta musi być kodem ISO 4217.');

const summary = text(1500).refine((value) => {
  const sentences = countSentences(value);
  return sentences >= SUMMARY_SENTENCES.min && sentences <= SUMMARY_SENTENCES.max;
}, `Podsumowanie musi mieć od ${SUMMARY_SENTENCES.min} do ${SUMMARY_SENTENCES.max} zdań.`);

const amount = z.object({
  value: z.number(),
  currency: currencyCode,
  context: text(200),
});

const dateEntry = z.object({ date: isoDate, context: text(200) });

const entities = z.object({
  organizations: z.array(text(200)).max(MAX_ENTITIES),
  people: z.array(text(120)).max(MAX_ENTITIES),
});

const meta = z.object({
  model: text(100),
  generatedAt: z.iso.datetime(),
  ocrPages: z.array(z.number().int().min(1).max(MAX_PAGES)),
  chunks: z.number().int().min(1),
  warnings: z.array(text(300)),
});

export const AnalysisResultSchema = z.object({
  document: z.object({
    fileName: text(MAX_FILE_NAME_CHARS),
    pages: z.number().int().min(1).max(MAX_PAGES),
    language: languageCode,
    type: z.enum(DOCUMENT_TYPES),
    title: text(300).nullable(),
    date: isoDate.nullable(),
  }),
  summary,
  keyPoints: z.array(text(300)).min(KEY_POINTS.min).max(KEY_POINTS.max),
  entities,
  amounts: z.array(amount).max(MAX_AMOUNTS),
  dates: z.array(dateEntry).max(MAX_DATES),
  keywords: z.array(text(60)).max(MAX_KEYWORDS),
  meta,
});

export type AnalysisResult = z.output<typeof AnalysisResultSchema>;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];
export type Amount = z.output<typeof amount>;

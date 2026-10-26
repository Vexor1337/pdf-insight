import { z } from 'zod';
import { MAX_AMOUNTS, MAX_DATES, MAX_ENTITIES, MAX_KEYWORDS } from '../../../shared/limits.ts';
import { DOCUMENT_TYPES, isIsoCalendarDate } from '../../../shared/schema.ts';
import { toProblems, type Validation } from './validatedRequest.ts';

const CURRENCY_ALIASES: Record<string, string> = {
  ZŁ: 'PLN',
  ZL: 'PLN',
  '€': 'EUR',
  $: 'USD',
  '£': 'GBP',
};

function normalizeCurrency(value: string): string {
  const upper = value.trim().toUpperCase();
  return CURRENCY_ALIASES[upper] ?? upper;
}

function lenientList<T extends z.ZodType>(item: T, max: number) {
  return z
    .array(z.unknown())
    .transform((items) =>
      items.flatMap((value) => {
        const parsed = item.safeParse(value);
        return parsed.success ? [parsed.data] : [];
      }),
    )
    .transform((items) => items.slice(0, max));
}

const nonEmpty = z.string().trim().min(1);

export const ModelAnalysisSchema = z.object({
  document: z.object({
    language: z.string().trim().toLowerCase(),
    type: z.enum(DOCUMENT_TYPES).catch('inne'),
    title: nonEmpty.nullable().catch(null),
    date: z
      .string()
      .nullable()
      .transform((value) => (value && isIsoCalendarDate(value) ? value : null))
      .catch(null),
  }),
  summary: nonEmpty,
  keyPoints: z.array(nonEmpty),
  entities: z.object({
    organizations: lenientList(nonEmpty, MAX_ENTITIES),
    people: lenientList(nonEmpty, MAX_ENTITIES),
  }),
  amounts: lenientList(
    z.object({
      value: z.number(),
      currency: z.string().transform(normalizeCurrency),
      context: nonEmpty,
    }),
    MAX_AMOUNTS,
  ),
  dates: lenientList(
    z.object({ date: z.string().refine(isIsoCalendarDate), context: nonEmpty }),
    MAX_DATES,
  ),
  keywords: lenientList(nonEmpty, MAX_KEYWORDS),
});

export type ModelAnalysis = z.output<typeof ModelAnalysisSchema>;

export const OcrOutputSchema = z.object({
  pages: z.array(z.object({ page: z.number().int(), text: z.string() })),
});

export function parseModelJson<T extends z.ZodType>(
  schema: T,
  raw: string,
): Validation<z.output<T>> {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { ok: false, problems: ['response is not valid JSON'] };
  }
  const parsed = schema.safeParse(json);
  return parsed.success
    ? { ok: true, data: parsed.data }
    : { ok: false, problems: toProblems(parsed.error) };
}

import { MAX_AMOUNTS, MAX_DATES, MAX_ENTITIES, MAX_KEYWORDS } from '../../../shared/limits.ts';
import type { ModelAnalysis } from './modelOutput.ts';

export function normalizeKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/ł/g, 'l')
    .replace(/Ł/g, 'L')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function uniqueBy<T>(items: readonly T[], key: (item: T) => string, max: number): T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const item of items) {
    const itemKey = key(item);
    if (!seen.has(itemKey)) {
      seen.add(itemKey);
      result.push(item);
    }
  }
  return result.slice(0, max);
}

export type ExtractedData = Pick<ModelAnalysis, 'entities' | 'amounts' | 'dates' | 'keywords'>;

export function mergeExtracted(parts: readonly ExtractedData[]): ExtractedData {
  return {
    entities: {
      organizations: uniqueBy(
        parts.flatMap((p) => p.entities.organizations),
        normalizeKey,
        MAX_ENTITIES,
      ),
      people: uniqueBy(
        parts.flatMap((p) => p.entities.people),
        normalizeKey,
        MAX_ENTITIES,
      ),
    },
    amounts: uniqueBy(
      parts.flatMap((p) => p.amounts),
      (amount) => `${amount.value}|${amount.currency}|${normalizeKey(amount.context)}`,
      MAX_AMOUNTS,
    ),
    dates: uniqueBy(
      parts.flatMap((p) => p.dates),
      (entry) => `${entry.date}|${normalizeKey(entry.context)}`,
      MAX_DATES,
    ),
    keywords: uniqueBy(
      parts.flatMap((p) => p.keywords),
      normalizeKey,
      MAX_KEYWORDS,
    ),
  };
}

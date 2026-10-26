import { sanitizeText } from '../../../shared/sanitize.ts';

export interface TextFragment {
  str: string;
  hasEOL: boolean;
}

export interface PageText {
  page: number;
  text: string;
}

export function joinFragments(fragments: readonly TextFragment[]): string {
  const raw = fragments.map((item) => item.str + (item.hasEOL ? '\n' : '')).join('');
  return tidyText(raw);
}

export function tidyText(raw: string): string {
  return sanitizeText(raw)
    .replace(/[ \t\u00A0]+/g, ' ')
    .replace(/(\p{L})-\n(\p{Ll})/gu, '$1-$2')
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function lineKey(line: string): string {
  return line.replace(/\d+/g, '#').toLowerCase();
}

const MIN_PAGES_FOR_REPEAT_DETECTION = 3;
const REPEAT_RATIO = 0.6;

export function stripRepeatedLines(pages: readonly PageText[]): PageText[] {
  if (pages.length < MIN_PAGES_FOR_REPEAT_DETECTION) return [...pages];

  const pageCountByKey = new Map<string, number>();
  for (const { text } of pages) {
    const keys = new Set(text.split('\n').filter(Boolean).map(lineKey));
    for (const key of keys) pageCountByKey.set(key, (pageCountByKey.get(key) ?? 0) + 1);
  }

  const threshold = Math.ceil(pages.length * REPEAT_RATIO);
  const isRepeated = (line: string) => (pageCountByKey.get(lineKey(line)) ?? 0) >= threshold;

  return pages.map((page, index) =>
    index === 0
      ? page
      : {
          page: page.page,
          text: page.text
            .split('\n')
            .filter((line) => line === '' || !isRepeated(line))
            .join('\n')
            .trim(),
        },
  );
}

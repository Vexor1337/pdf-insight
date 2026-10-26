import { MAX_INJECTION_EXCERPT_CHARS, MAX_SUSPECTED_INJECTIONS } from './limits.ts';

export interface SuspectedInjection {
  page: number;
  excerpt: string;
}

const PATTERNS: readonly RegExp[] = [
  /(?<!\p{L})(zignoruj|pomiń|zapomnij)[^.]{0,60}?(polece|instrukcj|zasad|reguł)\p{L}*/giu,
  /(?<!\p{L})instrukcj\p{L}*\s+dla\s+(systemu\s+)?(ai|sztucznej\s+inteligencji|modelu|asystenta|llm)(?!\p{L})/giu,
  /(?<!\p{L})nie\s+(wspominaj|ujawniaj|informuj)[^.]{0,40}?(instrukcj|polece)\p{L}*/giu,
  /(?<!\p{L})(jesteś\s+teraz|od\s+teraz\s+jesteś|udawaj,?\s+że)(?!\p{L})/giu,
  /(?<!\p{L})(prompt\s+systemowy|wiadomoś\p{L}*\s+systemow\p{L}*)/giu,
  /(?<!\p{L})ignore\s+(all\s+)?(the\s+)?(previous|prior|above|earlier)\s+(instructions|prompts?|rules)/giu,
  /(?<!\p{L})(disregard|forget)\s+(all\s+)?(the\s+)?(previous|prior|above|your)\s+(instructions|rules)/giu,
  /(?<!\p{L})(system\s+prompt|developer\s+message|you\s+are\s+now|new\s+instructions?\s*:)/giu,
  /(?<!\p{L})(instructions?\s+for\s+(the\s+)?(ai|assistant|model|llm))(?!\p{L})/giu,
];

const MERGE_DISTANCE = 300;
export const NEUTRALIZED_MARKER = '[fragment usunięty: podejrzenie próby manipulacji modelem AI]';

interface Span {
  start: number;
  end: number;
}

function lineStart(text: string, index: number): number {
  return text.lastIndexOf('\n', index - 1) + 1;
}

function lineEnd(text: string, index: number): number {
  const end = text.indexOf('\n', index);
  return end === -1 ? text.length : end;
}

function findSpans(text: string): Span[] {
  const spans: Span[] = PATTERNS.flatMap((pattern) =>
    [...text.matchAll(pattern)].map((match) => ({
      start: lineStart(text, match.index),
      end: lineEnd(text, match.index + match[0].length),
    })),
  ).sort((a, b) => a.start - b.start);

  const merged: Span[] = [];
  for (const span of spans) {
    const last = merged.at(-1);
    if (last && span.start - last.end <= MERGE_DISTANCE) last.end = Math.max(last.end, span.end);
    else merged.push({ ...span });
  }
  return merged;
}

export interface NeutralizedPage {
  page: number;
  text: string;
  injections: SuspectedInjection[];
}

export function neutralizeInjections(page: number, text: string): NeutralizedPage {
  const spans = findSpans(text);
  if (spans.length === 0) return { page, text, injections: [] };

  let output = '';
  let cursor = 0;
  const injections: SuspectedInjection[] = [];
  for (const span of spans) {
    output += text.slice(cursor, span.start) + NEUTRALIZED_MARKER;
    const excerpt = text.slice(span.start, span.end).replace(/\s+/g, ' ').trim();
    injections.push({ page, excerpt: excerpt.slice(0, MAX_INJECTION_EXCERPT_CHARS) });
    cursor = span.end;
  }
  output += text.slice(cursor);
  return { page, text: output, injections: injections.slice(0, MAX_SUSPECTED_INJECTIONS) };
}

export function containsInjectionPhrases(text: string): boolean {
  return findSpans(text).length > 0;
}

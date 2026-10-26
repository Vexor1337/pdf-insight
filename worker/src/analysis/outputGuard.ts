import { containsInjectionPhrases, type SuspectedInjection } from '../../../shared/injection.ts';
import type { ModelAnalysis } from './modelOutput.ts';

const SHINGLE_SIZE = 5;
const MIN_SHINGLE_CHARS = 20;

function words(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function shingles(text: string): Set<string> {
  const tokens = words(text);
  const result = new Set<string>();
  for (let index = 0; index + SHINGLE_SIZE <= tokens.length; index += 1) {
    const shingle = tokens.slice(index, index + SHINGLE_SIZE).join(' ');
    if (shingle.length >= MIN_SHINGLE_CHARS) result.add(shingle);
  }
  return result;
}

export function findInjectionEcho(
  analysis: ModelAnalysis,
  injections: readonly SuspectedInjection[],
): string | null {
  const prose = [analysis.summary, ...analysis.keyPoints].join('\n');
  if (containsInjectionPhrases(prose)) {
    return 'the summary or key points contain instructions instead of document facts';
  }
  const proseShingles = shingles(prose);
  const echoed = injections.some(({ excerpt }) =>
    [...shingles(excerpt)].some((shingle) => proseShingles.has(shingle)),
  );
  return echoed ? 'the answer repeats a removed, untrusted fragment of the document' : null;
}

const PREFIX_ABBREVIATIONS = new Set([
  'al',
  'art',
  'dr',
  'gen',
  'hab',
  'im',
  'inż',
  'kpt',
  'lek',
  'mec',
  'mgr',
  'm.in',
  'nr',
  'np',
  'ok',
  'os',
  'p',
  'pl',
  'pkt',
  'płk',
  'pn',
  'pod',
  'por',
  'poz',
  'prof',
  'red',
  'tel',
  'tj',
  'tzn',
  'tzw',
  'ul',
  'ust',
  'woj',
  'zob',
  'św',
  'approx',
  'dept',
  'e.g',
  'etc',
  'fig',
  'i.e',
  'inc',
  'jr',
  'mr',
  'mrs',
  'ms',
  'no',
  'sr',
  'st',
  'vol',
  'vs',
]);

const TERMINATOR = /[.!?…]+["'”’»)\]]*(?=\s|$)/gu;
const STARTS_SENTENCE = /^\s+["'„“«(]?\p{Lu}/u;
const WORD_BEFORE = /([\p{L}.]+)$/u;

function isSingleLetterInitial(word: string): boolean {
  return /^\p{Lu}$/u.test(word);
}

function isBoundary(text: string, matchIndex: number, matchEnd: number): boolean {
  const rest = text.slice(matchEnd);
  if (rest.trim() === '') return true;
  if (!text[matchIndex]?.startsWith('.')) return STARTS_SENTENCE.test(rest);
  if (!STARTS_SENTENCE.test(rest)) return false;

  const word = WORD_BEFORE.exec(text.slice(0, matchIndex))?.[1] ?? '';
  if (isSingleLetterInitial(word)) return false;
  return !PREFIX_ABBREVIATIONS.has(word.toLowerCase());
}

export function countSentences(text: string): number {
  const trimmed = text.trim();
  if (trimmed === '') return 0;

  let count = 0;
  let lastBoundaryEnd = 0;
  for (const match of trimmed.matchAll(TERMINATOR)) {
    const end = match.index + match[0].length;
    if (isBoundary(trimmed, match.index, end)) {
      count += 1;
      lastBoundaryEnd = end;
    }
  }
  const hasTrailingFragment = trimmed.slice(lastBoundaryEnd).trim() !== '';
  return hasTrailingFragment ? count + 1 : count;
}

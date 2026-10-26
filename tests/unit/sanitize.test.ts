import { describe, expect, it } from 'vitest';
import { sanitizeLine, sanitizeText } from '../../shared/sanitize.ts';

const char = (codePoint: number) => String.fromCodePoint(codePoint);
const ZERO_WIDTH_SPACE = char(0x200b);
const SOFT_HYPHEN = char(0xad);
const RIGHT_TO_LEFT_OVERRIDE = char(0x202e);
const LEFT_TO_RIGHT_ISOLATE = char(0x2066);

describe('sanitizeText', () => {
  it('removes zero-width, soft hyphen and bidi override characters', () => {
    const disguised = `fa${ZERO_WIDTH_SPACE}k${SOFT_HYPHEN}tu${RIGHT_TO_LEFT_OVERRIDE}ra${LEFT_TO_RIGHT_ISOLATE}`;
    expect(sanitizeText(disguised)).toBe('faktura');
  });

  it('removes control characters but keeps new lines and tabs', () => {
    expect(sanitizeText(`a${char(0)}b${char(7)}c\n\td`)).toBe('abc\n\td');
  });

  it('normalizes decomposed Polish letters to NFC', () => {
    const decomposed = 'Żółw'.normalize('NFD');
    expect(decomposed).not.toBe('Żółw');
    expect(sanitizeText(decomposed)).toBe('Żółw'.normalize('NFC'));
  });
});

describe('sanitizeLine', () => {
  it('collapses whitespace into single spaces', () => {
    expect(sanitizeLine('  Umowa \n ramowa\t nr 14 ')).toBe('Umowa ramowa nr 14');
  });
});

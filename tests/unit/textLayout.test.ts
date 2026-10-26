import { describe, expect, it } from 'vitest';
import { joinFragments, stripRepeatedLines, tidyText } from '../../src/lib/pdf/textLayout.ts';

describe('joinFragments', () => {
  it('joins items in stream order and breaks lines at hasEOL', () => {
    const text = joinFragments([
      { str: 'Umowa', hasEOL: false },
      { str: ' ', hasEOL: false },
      { str: 'ramowa', hasEOL: true },
      { str: 'nr 14/2026', hasEOL: true },
    ]);
    expect(text).toBe('Umowa ramowa\nnr 14/2026');
  });
});

describe('tidyText', () => {
  it('re-joins compounds split at the end of a line', () => {
    expect(tidyText('po upływie 12 miesięcy od Go-\nlive.')).toBe(
      'po upływie 12 miesięcy od Go-live.',
    );
  });

  it('keeps line breaks before capitalised lines and collapses blank lines', () => {
    expect(tidyText('Kwota netto -\nRazem\n\n\n\nStrona  2')).toBe(
      'Kwota netto -\nRazem\n\nStrona 2',
    );
  });

  it('removes invisible characters from extracted text', () => {
    expect(tidyText(`a${String.fromCodePoint(0x200b)}b`)).toBe('ab');
  });
});

describe('stripRepeatedLines', () => {
  const page = (number: number, body: string) => ({
    page: number,
    text: `Umowa ramowa nr 14/2026 — Nordwave / Kwadrat\n${body}\nWersja 1.3 · 12.03.2026\nStrona ${String(number)} z 4`,
  });

  it('removes running headers and footers except on the first page', () => {
    const pages = [
      page(1, 'Strony umowy'),
      page(2, '§ 1. Definicje'),
      page(3, '§ 4. Harmonogram'),
      page(4, 'Podpisy'),
    ];
    const result = stripRepeatedLines(pages);
    expect(result[0]?.text).toContain('Strona 1 z 4');
    expect(result[1]?.text).toBe('§ 1. Definicje');
    expect(result[3]?.text).toBe('Podpisy');
  });

  it('leaves short documents untouched', () => {
    const pages = [page(1, 'A'), page(2, 'B')];
    expect(stripRepeatedLines(pages)).toEqual(pages);
  });
});

import { describe, expect, it } from 'vitest';
import { chunkPages } from '../src/analysis/chunk.ts';
import { findDates, findNumbers, groundAnalysis } from '../src/analysis/grounding.ts';
import { mergeExtracted, normalizeKey } from '../src/analysis/merge.ts';

const NBSP = String.fromCodePoint(0xa0);

describe('findNumbers', () => {
  it.each([
    ['184 500,00 zł', 184500],
    [`184${NBSP}500,00 zł`, 184500],
    ['2 150 EUR', 2150],
    ['1,200.50 USD', 1200.5],
    ['12 730,50', 12730.5],
    ['4,2 mln zł', 4200000],
    ['14 tys. zł', 14000],
  ])('reads %s as %d', (text, expected) => {
    expect(findNumbers(text).all.has(expected)).toBe(true);
  });

  it('marks only numbers next to a currency as monetary', () => {
    const found = findNumbers('§ 1 ust. 2. Rekompensata 40 EUR.');
    expect(found.withCurrency.has(40)).toBe(true);
    expect(found.withCurrency.has(1)).toBe(false);
  });
});

describe('groundAnalysis', () => {
  it('finds values that a PDF line break split in two', () => {
    const analysis = {
      document: { language: 'pl', type: 'umowa' as const, title: null, date: null },
      summary: 'x',
      keyPoints: [],
      entities: { organizations: [], people: [] },
      amounts: [{ value: 295200, currency: 'PLN', context: 'abonament za 24 miesiące' }],
      dates: [{ date: '2026-03-02', context: 'pełnomocnictwo' }],
      keywords: [],
    };
    const source =
      'abonament 12 300,00 zł/mies. (295\n200,00 zł za 24 miesiące)\nz dnia 2\nmarca 2026 r.';
    const { analysis: grounded, warnings } = groundAnalysis(analysis, source);
    expect(grounded.amounts).toHaveLength(1);
    expect(grounded.dates).toHaveLength(1);
    expect(warnings).toEqual([]);
  });
});

describe('findDates', () => {
  it('reads Polish, English and ISO formats', () => {
    const dates = findDates(
      'Zawarta 12.03.2026 r., obowiązuje od 1 kwietnia 2026 r. do 31 marca 2028. Issue date: 2026-10-05, due October 19, 2026.',
    );
    expect([...dates].sort()).toEqual([
      '2026-03-12',
      '2026-04-01',
      '2026-10-05',
      '2026-10-19',
      '2028-03-31',
    ]);
  });
});

describe('chunkPages', () => {
  it('keeps small documents in one chunk', () => {
    const pages = [
      { page: 1, text: 'a'.repeat(10) },
      { page: 2, text: 'b'.repeat(10) },
    ];
    expect(chunkPages(pages, 100)).toEqual([pages]);
  });

  it('cuts at page boundaries and splits oversized pages', () => {
    const chunks = chunkPages(
      [
        { page: 1, text: 'a'.repeat(60) },
        { page: 2, text: 'b'.repeat(60) },
        { page: 3, text: 'c'.repeat(250) },
      ],
      100,
    );
    expect(
      chunks.map((chunk) =>
        chunk.map((part) => `${String(part.page)}:${String(part.text.length)}`),
      ),
    ).toEqual([['1:60'], ['2:60'], ['3:100'], ['3:100'], ['3:50']]);
  });
});

describe('mergeExtracted', () => {
  it('deduplicates entities ignoring case and diacritics, keeping the first spelling', () => {
    const merged = mergeExtracted([
      {
        entities: { organizations: ['Kwadrat Software S.A.'], people: ['Anna Kowalczyk'] },
        amounts: [],
        dates: [],
        keywords: ['CRM'],
      },
      {
        entities: {
          organizations: ['KWADRAT SOFTWARE S.A'],
          people: ['ANNA KOWALCZYK', 'Paweł Dąbrowski'],
        },
        amounts: [],
        dates: [],
        keywords: ['crm', 'SLA'],
      },
    ]);
    expect(merged.entities.organizations).toEqual(['Kwadrat Software S.A.']);
    expect(merged.entities.people).toEqual(['Anna Kowalczyk', 'Paweł Dąbrowski']);
    expect(merged.keywords).toEqual(['CRM', 'SLA']);
  });

  it('normalizes Polish letters', () => {
    expect(normalizeKey('Michał Kamiński')).toBe(normalizeKey('MICHAL KAMINSKI'));
  });
});

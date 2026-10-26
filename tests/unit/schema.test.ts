import { describe, expect, it } from 'vitest';
import { AnalysisResultSchema, isIsoCalendarDate } from '../../shared/schema.ts';
import { validResult } from './helpers/validResult.ts';

function parse(value: unknown) {
  return AnalysisResultSchema.safeParse(value);
}

describe('AnalysisResultSchema', () => {
  it('accepts the example result from the brief', () => {
    expect(parse(validResult()).success).toBe(true);
  });

  it('accepts null for unknown title and date', () => {
    const result = validResult();
    result.document.title = null;
    result.document.date = null;
    expect(parse(result).success).toBe(true);
  });

  it('accepts empty arrays when the document has no such data', () => {
    const result = { ...validResult(), amounts: [], dates: [], keywords: [] };
    result.entities = { organizations: [], people: [] };
    expect(parse(result).success).toBe(true);
  });

  it.each(['document', 'summary', 'keyPoints', 'entities', 'amounts', 'dates', 'keywords'])(
    'rejects a result without "%s"',
    (key) => {
      const result = Object.fromEntries(
        Object.entries(validResult()).filter(([entryKey]) => entryKey !== key),
      );
      expect(parse(result).success).toBe(false);
    },
  );

  it('rejects arrays replaced by null', () => {
    expect(parse({ ...validResult(), amounts: null }).success).toBe(false);
  });

  it.each(['12.03.2026', '2026-3-1', '2026-02-30', '2026-13-01', ''])(
    'rejects invalid document date "%s"',
    (date) => {
      const result = validResult();
      result.document.date = date;
      expect(parse(result).success).toBe(false);
    },
  );

  it.each(['zł', 'pln', 'PL', 'ZLO', '$'])('rejects non ISO 4217 currency "%s"', (currency) => {
    const result = validResult();
    result.amounts = [{ value: 1, currency, context: 'x' }];
    expect(parse(result).success).toBe(false);
  });

  it.each(['PLN', 'EUR', 'USD'])('accepts ISO 4217 currency "%s"', (currency) => {
    const result = validResult();
    result.amounts = [{ value: 8600, currency, context: 'licencje' }];
    expect(parse(result).success).toBe(true);
  });

  it('rejects amount values given as strings', () => {
    const result = {
      ...validResult(),
      amounts: [{ value: '184 500,00', currency: 'PLN', context: 'x' }],
    };
    expect(parse(result).success).toBe(false);
  });

  it('rejects non-finite amount values', () => {
    const result = validResult();
    result.amounts = [{ value: Number.POSITIVE_INFINITY, currency: 'PLN', context: 'x' }];
    expect(parse(result).success).toBe(false);
  });

  it('rejects document types outside the enum', () => {
    const result = { ...validResult(), document: { ...validResult().document, type: 'aneks' } };
    expect(parse(result).success).toBe(false);
  });

  it.each(['pol', 'PL', 'p', 'pl-PL'])('rejects language code "%s"', (language) => {
    const result = validResult();
    result.document.language = language;
    expect(parse(result).success).toBe(false);
  });

  it.each([
    ['two sentences', 'Pierwsze zdanie. Drugie zdanie.', false],
    ['three sentences', 'Jeden. Dwa. Trzy.', true],
    ['five sentences', 'Jeden. Dwa. Trzy. Cztery. Pięć.', true],
    ['six sentences', 'Jeden. Dwa. Trzy. Cztery. Pięć. Sześć.', false],
  ])('validates summary length: %s', (_label, summary, expected) => {
    expect(parse({ ...validResult(), summary }).success).toBe(expected);
  });

  it.each([2, 8])('rejects %i key points', (count) => {
    const keyPoints = Array.from({ length: count }, (_, index) => `Punkt ${index + 1}`);
    expect(parse({ ...validResult(), keyPoints }).success).toBe(false);
  });

  it('rejects blank strings', () => {
    expect(parse({ ...validResult(), keywords: ['   '] }).success).toBe(false);
  });

  it('rejects strings above the length limit', () => {
    expect(parse({ ...validResult(), keywords: ['x'.repeat(61)] }).success).toBe(false);
  });

  it('strips invisible and bidi characters from text values', () => {
    const result = validResult();
    result.keywords = ['ser\u200Bwis', 'S\u202ELA'];
    const parsed = parse(result);
    expect(parsed.success && parsed.data.keywords).toEqual(['serwis', 'SLA']);
  });

  it('keeps markup as plain text (rendering escapes it)', () => {
    const result = validResult();
    result.keywords = ['<img src=x onerror=alert(1)>'];
    const parsed = parse(result);
    expect(parsed.success && parsed.data.keywords[0]).toBe('<img src=x onerror=alert(1)>');
  });

  it('does not reject unknown additional fields (fields may be added)', () => {
    expect(parse({ ...validResult(), extra: { anything: true } }).success).toBe(true);
  });
});

describe('isIsoCalendarDate', () => {
  it.each([
    ['2026-03-12', true],
    ['2028-02-29', true],
    ['2026-02-29', false],
    ['2026-04-31', false],
    ['26-03-12', false],
  ])('%s → %s', (value, expected) => {
    expect(isIsoCalendarDate(value)).toBe(expected);
  });
});

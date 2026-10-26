import type { AnalysisResult } from '../../../shared/schema.ts';

export function validResult(): AnalysisResult {
  return {
    document: {
      fileName: 'umowa.pdf',
      pages: 4,
      language: 'pl',
      type: 'umowa',
      title: 'Umowa serwisowa',
      date: '2026-09-01',
    },
    summary:
      'Umowa określa zasady świadczenia usług serwisowych. Zawarto ją między Przykład sp. z o.o. a Wykonawcą. Wynagrodzenie wynosi 12 500 zł.',
    keyPoints: ['Okres umowy 12 mies.', 'Wynagrodzenie 12 500 zł', 'Termin płatności 14 dni'],
    entities: { organizations: ['Przykład sp. z o.o.'], people: [] },
    amounts: [{ value: 12500, currency: 'PLN', context: 'wynagrodzenie' }],
    dates: [{ date: '2026-10-01', context: 'termin płatności' }],
    keywords: ['serwis', 'SLA'],
    meta: {
      model: 'gemini-test',
      generatedAt: '2026-10-26T12:00:00.000Z',
      ocrPages: [],
      chunks: 1,
      warnings: [],
    },
  };
}

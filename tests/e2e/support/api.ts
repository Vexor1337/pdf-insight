import type { Page, Request, Route } from '@playwright/test';
import type { AnalysisResult } from '../../../shared/schema.ts';

export const API_ROUTE = '**/api/analyze';

export function sampleResult(overrides: Partial<AnalysisResult> = {}): AnalysisResult {
  return {
    document: {
      fileName: 'contract-pl.pdf',
      pages: 1,
      language: 'pl',
      type: 'umowa',
      title: 'Umowa serwisowa nr 5/2026',
      date: '2026-09-01',
    },
    summary:
      'Umowa serwisowa została zawarta między Przyklad sp. z o.o. a Serwis Test S.A. Obowiązuje od 1 października 2026 r. przez 12 miesięcy. Wynagrodzenie wynosi 12 500 zł netto miesięcznie.',
    keyPoints: [
      'Okres obowiązywania 12 miesięcy',
      'Wynagrodzenie 12 500 zł netto miesięcznie',
      'Termin płatności 14 dni',
    ],
    entities: {
      organizations: ['Przyklad sp. z o.o.', 'Serwis Test S.A.'],
      people: ['Jan Kowalski'],
    },
    amounts: [
      { value: 12500, currency: 'PLN', context: 'wynagrodzenie miesięczne' },
      { value: 1200, currency: 'EUR', context: 'opłata licencyjna rocznie' },
    ],
    dates: [
      { date: '2026-09-01', context: 'zawarcie umowy' },
      { date: '2026-10-01', context: 'pierwsza płatność' },
    ],
    keywords: ['serwis', 'umowa', 'wynagrodzenie'],
    meta: {
      model: 'mock-model',
      generatedAt: '2026-10-26T12:00:00.000Z',
      ocrPages: [],
      chunks: 1,
      warnings: [],
    },
    ...overrides,
  };
}

type Responder = (request: Request) => {
  status: number;
  body: unknown;
  headers?: Record<string, string>;
};

export async function mockApi(page: Page, responder: Responder): Promise<unknown[]> {
  const bodies: unknown[] = [];
  await page.route(API_ROUTE, async (route: Route) => {
    const request = route.request();
    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204 });
      return;
    }
    bodies.push(request.postDataJSON());
    const { status, body, headers } = responder(request);
    await route.fulfill({
      status,
      contentType: 'application/json',
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Expose-Headers': 'Retry-After',
        ...headers,
      },
      body: JSON.stringify(body),
    });
  });
  return bodies;
}

export const ok =
  (result: AnalysisResult = sampleResult()) =>
  () => ({
    status: 200,
    body: { result },
  });

export const apiError = (status: number, code: string, headers?: Record<string, string>) => () => ({
  status,
  body: { error: { code, message: 'mock' } },
  ...(headers ? { headers } : {}),
});

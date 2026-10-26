import { describe, expect, it } from 'vitest';
import { countSentences } from '../../shared/sentences.ts';

describe('countSentences', () => {
  it.each([
    ['', 0],
    ['Jedno zdanie bez kropki', 1],
    ['Pierwsze. Drugie! Trzecie? Czwarte…', 4],
    ['Umowę zawarła Nordwave Logistics sp. z o.o. z siedzibą w Gdańsku.', 1],
    ['Strony to Nordwave Logistics sp. z o.o. i Kwadrat Software S.A. z Wrocławia.', 1],
    ['Wykonawcą jest Kwadrat Software S.A. Umowa obowiązuje 24 miesiące.', 2],
    ['Umowę zawarto 12.03.2026 r. w Gdańsku.', 1],
    ['Umowę zawarto 12 marca 2026 r. Obowiązuje od 1 kwietnia.', 2],
    ['Siedziba mieści się przy ul. Portowa 18 w Gdańsku.', 1],
    ['Dotyczy umowy nr 14/2026 i § 5 ust. 2 umowy.', 1],
    ['Obsługa ok. 3 400 klientów, tj. Polska i Niemcy.', 1],
    ['Zakres obejmuje m.in. SAP Business One oraz pocztę.', 1],
    ['Aneks podpisali A. Kowalczyk i P. Dąbrowski. Wszedł w życie z dniem podpisania.', 2],
    ['Prowadzi go dr Nowak. Raport ma wersję 1.3 z dnia 12.03.2026.', 2],
    ['Umowa jest „wiążąca”. Strony ją podpisały.', 2],
    ['The agreement was signed by Mr. Smith, e.g. for Acme Inc. in 2026.', 1],
  ])('"%s" → %i', (text, expected) => {
    expect(countSentences(text)).toBe(expected);
  });
});

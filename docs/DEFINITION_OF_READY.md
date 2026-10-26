# Definition of Ready i Definition of Done

**Definition of Ready (DoR)** określa, kiedy zadanie jest gotowe do rozpoczęcia implementacji. **Definition of Done (DoD)** określa, kiedy zadanie jest skończone. Brief podaje DoD na poziomie produktu (sekcja 01); poniżej jest DoR dla każdego zadania w projekcie, DoD na poziomie zadania oraz stan obu list dla PDF Insight.

## 1. Definition of Ready — zadanie

Zadanie (funkcja, poprawka, zmiana techniczna) można wziąć do realizacji, gdy:

| #    | Kryterium                                                                                                             |
| ---- | --------------------------------------------------------------------------------------------------------------------- |
| R-01 | Cel jest opisany z perspektywy użytkownika („jako… chcę… aby…”) albo jako konkretny problem techniczny                |
| R-02 | Kryteria akceptacji są mierzalne i testowalne (np. „wynik < 30 s”, „plik > 10 MB odrzucony przed wysłaniem do API”)   |
| R-03 | Zadanie ma przypisany priorytet z briefu (MUST / SHOULD / COULD) albo uzasadnienie, dlaczego jest potrzebne           |
| R-04 | Wejścia i wyjścia są zdefiniowane: kontrakt danych (schemat Zod w `shared/`), formaty, limity z `shared/limits.ts`    |
| R-05 | Znane są zależności (inne zadania, konta, klucze, usługi zewnętrzne) i są dostępne albo zaplanowane                   |
| R-06 | Zidentyfikowano ryzyka bezpieczeństwa i sposób ich ograniczenia (model zagrożeń: `docs/ANALIZA.md`, sekcja 4)         |
| R-07 | Wiadomo, jak zadanie będzie przetestowane: przypadki jednostkowe i/lub scenariusze E2E są nazwane przed implementacją |
| R-08 | Komunikaty dla użytkownika są ustalone po polsku; widok jest zaplanowany od 360 px i dla obsługi klawiaturą           |
| R-09 | Zadanie mieści się w jednym lub kilku logicznych commitach (Conventional Commits) — jeśli nie, zostało podzielone     |
| R-10 | Brak otwartych pytań blokujących; decyzje wymagające właściciela produktu zostały podjęte                             |

## 2. Definition of Done — zadanie

| #    | Kryterium                                                                                                    |
| ---- | ------------------------------------------------------------------------------------------------------------ |
| D-01 | Kryteria akceptacji z DoR spełnione i zweryfikowane                                                          |
| D-02 | `npm run check` zielone: ESLint (bez `any`, `console`, `dangerouslySetInnerHTML`), TypeScript strict, Vitest |
| D-03 | Testy E2E (Playwright, desktop + 360 px, axe) zielone                                                        |
| D-04 | Nowa logika ma testy; naprawiony błąd ma test, który by go wykrył                                            |
| D-05 | Brak sekretów w kodzie i historii Git                                                                        |
| D-06 | Kod przeszedł przegląd: czytelne nazwy, małe funkcje, komentarze tylko przy interfejsach i typach            |
| D-07 | README / AI_LOG / dokumentacja zaktualizowane, jeśli zmiana tego wymaga                                      |
| D-08 | Zmiana wdrożona przez pipeline (lint › build › testy › deploy) i sprawdzona na demo                          |

## 3. Definition of Done — produkt (z briefu)

Osoba z zewnątrz otwiera link do demo i bez instrukcji:

- [x] wgrywa własny PDF — stan pusty z instrukcją, drag & drop, wybór pliku, obsługa klawiaturą,
- [x] w mniej niż 30 sekund widzi podsumowanie i dane — zmierzone na pliku testowym: 10,6–18,5 s,
- [x] pobiera plik JSON zgodny ze schematem — test E2E waliduje pobrany plik schematem Zod.

## 4. Stan DoR dla zakresu PDF Insight

| Element zakresu        | R-01…R-04 (cel, akceptacja, priorytet, kontrakt)         | R-05 (zależności)                | R-06 (ryzyka)                 | R-07 (testy)                        | Gotowe |
| ---------------------- | -------------------------------------------------------- | -------------------------------- | ----------------------------- | ----------------------------------- | ------ |
| F-01 Wgrywanie PDF     | MUST; PDF ≤ 10 MB; `validateFile.ts`                     | —                                | pliki podszyte pod PDF, DoS   | S-17/18, E-05/06, `files.test.ts`   | ✅     |
| F-02 Odczyt tekstu     | MUST; tekst per strona                                   | pdf.js 6                         | CVE-2024-4367, złośliwe PDF   | `textLayout.test.ts`, E2E fixtures  | ✅     |
| F-03 Podsumowanie      | MUST; 3–5 zdań, język dokumentu                          | Gemini API (klucz, darmowy plan) | prompt injection, halucynacje | `sentences.test.ts`, `analyze.test` | ✅     |
| F-04 Dane strukturalne | MUST; schemat z sekcji 04, walidacja przed wyświetleniem | —                                | niepoprawny JSON z modelu     | `schema.test.ts`, E-10              | ✅     |
| F-05 Widok i eksport   | MUST; podgląd + `.json`                                  | —                                | XSS, złośliwa nazwa pliku     | E-11–E-14, `security.spec`          | ✅     |
| F-06 Stany interfejsu  | MUST; ładowanie, błąd z ponowieniem, pusty               | —                                | —                             | `states-and-errors.spec`            | ✅     |
| F-07 Publiczne demo    | MUST; `https://vexor1337.github.io/pdf-insight/`         | GitHub Pages, Cloudflare Worker  | klucz API, CORS, limity       | `live.spec` (`@live`)               | ✅     |
| F-08 Długie dokumenty  | SHOULD; podział po stronach + scalanie                   | —                                | wyczerpanie limitu AI         | `grounding.test`, `analyze.test`    | ✅     |
| F-09 Historia          | SHOULD; ostatnie 10 wyników lokalnie                     | —                                | zmanipulowany `localStorage`  | `history.test.ts`, E-15/16          | ✅     |
| F-10 OCR               | COULD; skany bez warstwy tekstowej                       | model multimodalny               | injection w obrazie           | `analyze.test` (OCR), E-18          | ✅     |

R-08 (PL, 360 px, klawiatura), R-09 (Conventional Commits) i R-10 (brak otwartych pytań) są spełnione dla całego zakresu.

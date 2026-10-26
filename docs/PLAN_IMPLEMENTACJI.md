# PDF Insight — plan implementacji

> Plan oparty na [ANALIZA.md](./ANALIZA.md). Odwołania typu „P3”, „B6” wskazują pułapki z analizy.
> Termin: **27.10.2026, 10:01**. Cel: działające demo produkcyjne najpóźniej wieczorem 26.10, rano tylko poprawki.

---

## 0. Założenia

- **Repo:** `pdf-insight` (publiczne, konto `Vexor1337`) → demo `https://vexor1337.github.io/pdf-insight/`.
- **Język:** TypeScript strict w całym projekcie (front, worker, testy) — wymóg briefu (B17).
- **LLM:** Gemini Flash przez Cloudflare Worker; model konfigurowany zmienną `GEMINI_MODEL` + model zapasowy `GEMINI_FALLBACK_MODEL` (B10).
- **Kolejność priorytetów:** MUST → bezpieczeństwo → OCR (P3) → historia (F-09) → chunking (F-08) → dopieszczenie UX.

## 1. Zasady jakości kodu (obowiązują w każdej fazie)

1. **Jedna odpowiedzialność:** komponenty prezentacyjne bez logiki; logika w czystych funkcjach `lib/`; efekty uboczne (sieć, storage, pdf.js) za cienkimi adapterami.
2. **Czyste funkcje + wstrzykiwanie zależności:** np. `analyzeDocument(input, { fetch, signal })` — łatwe testowanie bez mocków globalnych.
3. **Typy jako kontrakt:** typy wyprowadzane z Zod (`z.infer`), jeden schemat w `shared/`; stan UI jako unia dyskryminowana (`idle | reading | ocr | analyzing | success | error`).
4. **Błędy jako wartości:** `AppError` z kodem (`FILE_TOO_LARGE`, `NOT_PDF`, `ENCRYPTED`, `NO_TEXT`, `RATE_LIMITED`, `AI_INVALID`, `NETWORK`, `TIMEOUT`…) → jedno miejsce mapowania kod → komunikat PL (`lib/errors.ts`).
5. **Brak magicznych liczb:** limity w `shared/limits.ts` (wspólne dla frontu i workera).
6. **Nazewnictwo:** angielskie nazwy w kodzie, polskie teksty UI (wszystkie w `src/i18n/pl.ts`).
7. **Zakazy (egzekwowane ESLintem):** `any`, `console.*`, `dangerouslySetInnerHTML`, `eval`, `innerHTML`, nieobsłużone Promise, importy cykliczne.
8. **Małe pliki:** cel < 150 linii na plik, funkcje < 30 linii.
9. **Komentarze** tylko „dlaczego”, nie „co”.
10. **Każdy commit przechodzi** `lint + typecheck + test`.

## 2. Struktura repozytorium

```
pdf-insight/
├─ .github/workflows/
│  └─ ci-deploy.yml            # lint › typecheck › unit › build › e2e › deploy Pages
├─ docs/
│  ├─ ANALIZA.md
│  ├─ PLAN_IMPLEMENTACJI.md
│  └─ screenshot.png
├─ shared/                     # kod współdzielony front ↔ worker (bez zależności od DOM/Workers)
│  ├─ schema.ts                # Zod: AnalysisResult, AnalyzeRequest, AnalyzeResponse
│  ├─ limits.ts                # MAX_FILE_BYTES, MAX_PAGES, MAX_TEXT_CHARS, MAX_OCR_PAGES…
│  ├─ sentences.ts             # countSentences() z obsługą skrótów (B13)
│  ├─ sanitize.ts              # usuwanie znaków sterujących/BiDi/zero-width, NFC
│  └─ currencies.ts            # biała lista ISO 4217
├─ src/
│  ├─ main.tsx, App.tsx
│  ├─ components/
│  │  ├─ Dropzone.tsx          # drop + input + klawiatura, aria
│  │  ├─ PrivacyNotice.tsx     # „plik trafia do API AI”
│  │  ├─ ProgressStatus.tsx    # etapy ładowania (aria-live)
│  │  ├─ ErrorState.tsx        # komunikat + „Spróbuj ponownie”
│  │  ├─ EmptyState.tsx
│  │  ├─ ResultView.tsx        # kompozycja sekcji wyniku
│  │  ├─ result/ DocumentCard, SummarySection, KeyPoints, EntitiesList,
│  │  │          AmountsTable, DatesTable, KeywordsList, WarningsBanner
│  │  ├─ JsonPreview.tsx       # <pre> + kopiuj
│  │  ├─ DownloadButton.tsx
│  │  └─ HistoryPanel.tsx
│  ├─ hooks/
│  │  └─ useAnalysis.ts        # maszyna stanów (useReducer) + anulowanie (AbortController)
│  ├─ lib/
│  │  ├─ validateFile.ts       # rozszerzenie, MIME, %PDF-, rozmiar (F-01)
│  │  ├─ pdf/
│  │  │  ├─ loadPdf.ts         # bezpieczna konfiguracja pdf.js (CVE-2024-4367)
│  │  │  ├─ extractText.ts     # linie wg Y/X, scalanie łączników, znaczniki stron (P14)
│  │  │  ├─ stripRepeated.ts   # nagłówki/stopki (P15)
│  │  │  └─ renderPageImage.ts # canvas → JPEG dla stron bez tekstu (P3)
│  │  ├─ injection.ts          # detektor wzorców injection (warstwa 5)
│  │  ├─ history.ts            # localStorage + walidacja Zod przy odczycie
│  │  ├─ download.ts           # Blob JSON, bezpieczna nazwa pliku
│  │  └─ errors.ts             # AppError + mapowanie na komunikaty PL
│  ├─ api/
│  │  └─ analyzeClient.ts      # fetch do workera, timeout, mapowanie statusów → AppError
│  ├─ i18n/pl.ts
│  └─ styles/                  # CSS (tokeny kolorów, kontrast AA, 360 px)
├─ worker/
│  ├─ src/
│  │  ├─ index.ts              # router: OPTIONS, POST /api/analyze, reszta 404/405
│  │  ├─ http/cors.ts          # biała lista Origin (B6)
│  │  ├─ http/guards.ts        # Content-Type, Content-Length, rate limit (B7)
│  │  ├─ llm/gemini.ts         # klient Gemini (timeout, fallback modelu)
│  │  ├─ llm/prompt.ts         # systemInstruction + opakowanie dokumentu z nonce
│  │  ├─ llm/responseSchema.ts # schemat JSON dla trybu structured output
│  │  ├─ analysis/analyze.ts   # orkiestracja: chunk → LLM → walidacja → retry → merge
│  │  ├─ analysis/chunk.ts     # podział po granicach stron (F-08)
│  │  ├─ analysis/merge.ts     # łączenie wyników fragmentów, deduplikacja (P11)
│  │  ├─ analysis/grounding.ts # weryfikacja kwot i dat w źródle (P6, P7)
│  │  └─ analysis/outputGuard.ts # wykrycie skutków injection w wyniku (P1)
│  ├─ test/                    # Vitest dla workera
│  ├─ wrangler.toml
│  └─ .dev.vars.example
├─ tests/
│  ├─ unit/                    # Vitest dla shared/ i src/lib
│  ├─ e2e/                     # Playwright
│  └─ fixtures/
│     ├─ generate.ts           # generator fixture PDF (pdf-lib)
│     └─ ai-responses/         # przykładowe odpowiedzi API do mocków
├─ .env.example, .gitignore, .prettierrc, eslint.config.js
├─ playwright.config.ts, vitest.config.ts, tsconfig*.json, vite.config.ts
├─ index.html                  # meta CSP
├─ README.md
└─ AI_LOG.md
```

## 3. Kontrakty danych

### 3.1 Wynik analizy (`shared/schema.ts`) — zgodny z briefem + pole `meta`

```ts
const IsoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(isRealCalendarDate);
const Text = (max: number) => z.string().trim().min(1).max(max).transform(sanitize);

export const AnalysisResultSchema = z.object({
  document: z.object({
    fileName: Text(255),
    pages: z.number().int().min(1).max(MAX_PAGES),
    language: z.string().regex(/^[a-z]{2}$/), // ISO 639-1
    type: z.enum(['faktura', 'umowa', 'oferta', 'raport', 'inne']),
    title: Text(300).nullable(),
    date: IsoDate.nullable(),
  }),
  summary: Text(1500).refine((s) => inRange(countSentences(s), 3, 5)),
  keyPoints: z.array(Text(300)).min(3).max(7),
  entities: z.object({
    organizations: z.array(Text(200)).max(30),
    people: z.array(Text(120)).max(30),
  }),
  amounts: z
    .array(
      z.object({
        value: z.number().finite(),
        currency: z.string().refine(isIso4217), // P4
        context: Text(200),
      }),
    )
    .max(20),
  dates: z.array(z.object({ date: IsoDate, context: Text(200) })).max(20),
  keywords: z.array(Text(60)).max(15),
  meta: z.object({
    // pole dodatkowe (B15)
    model: z.string(),
    generatedAt: z.string().datetime(),
    ocrPages: z.array(z.number().int()),
    chunks: z.number().int(),
    warnings: z.array(z.string()),
  }),
});
```

### 3.2 Żądanie do workera (`AnalyzeRequestSchema`)

```ts
{ fileName: string ≤255, pages: int 1..MAX_PAGES,
  pagesText: Array<{ page: int, text: string }>   // łącznie ≤ MAX_TEXT_CHARS
  images:   Array<{ page: int, mime: 'image/jpeg', dataBase64: string ≤ MAX_IMAGE_B64 }> // ≤ MAX_OCR_PAGES
  suspectedInjection: Array<{ page: int, excerpt: string ≤ 500 }> }
```

### 3.3 Odpowiedź workera

- `200 { result: AnalysisResult }`
- błąd: `{ error: { code: ErrorCode, message: string /* PL */ } }` ze statusem `400 | 403 | 405 | 413 | 415 | 429 | 502 | 504`.

### 3.4 Limity (`shared/limits.ts`) — wartości startowe

| Stała                                        | Wartość              |
| -------------------------------------------- | -------------------- |
| `MAX_FILE_BYTES`                             | 10 MB                |
| `MAX_PAGES`                                  | 300                  |
| `MAX_TEXT_CHARS`                             | 400 000              |
| `CHUNK_CHARS`                                | 60 000               |
| `MAX_OCR_PAGES`                              | 5                    |
| `OCR_MIN_TEXT_CHARS` (strona uznana za skan) | 20                   |
| `OCR_RENDER_MAX_PX`                          | 1400                 |
| `MAX_REQUEST_BYTES` (worker)                 | 6 MB                 |
| `RATE_LIMIT`                                 | 10 żądań / 60 s / IP |
| `CLIENT_TIMEOUT_MS` / `LLM_TIMEOUT_MS`       | 45 000 / 25 000      |
| `HISTORY_LIMIT`                              | 10                   |

## 4. Fazy realizacji

Każda faza kończy się zielonym `npm run check` (lint + typecheck + test) i commitem w konwencji Conventional Commits.

### Faza 0 — Środowisko (~20 min)

- [ ] Instalacja Node.js LTS (`winget install OpenJS.NodeJS.LTS`).
- [ ] **Użytkownik:** konto Cloudflare + `npx wrangler login`.
- [ ] **Użytkownik:** klucz Gemini z AI Studio (nie wklejać do czatu ani plików w repo).
- [ ] Weryfikacja aktualnej nazwy modelu i limitów darmowego tieru Gemini (B10).

### Faza 1 — Szkielet i jakość (~45 min)

- [ ] `git init`, **pierwszy commit:** `.gitignore` (`node_modules`, `dist`, `.env*` z wyjątkiem `.env.example`, `.dev.vars`, `playwright-report`, `test-results`) (B5).
- [ ] Vite + React + TS; `tsconfig` strict (+ `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`).
- [ ] ESLint (typescript-eslint strict, react-hooks, jsx-a11y) z regułami: `no-console`, `no-explicit-any`, `no-eval`, `no-restricted-syntax` (zakaz `dangerouslySetInnerHTML`, `innerHTML`), `no-floating-promises`; Prettier.
- [ ] Vitest + Playwright (+ `@axe-core/playwright`) skonfigurowane, przykładowe testy.
- [ ] `vite.config.ts`: `base: '/pdf-insight/'` (B1).
- [ ] `index.html`: meta CSP (sekcja 4.4 analizy), `lang="pl"`.
- [ ] Skrypty: `dev`, `build`, `preview`, `lint`, `typecheck`, `test`, `test:e2e`, `check`.
- [ ] `gh repo create pdf-insight --public`, push.
- [ ] Workflow CI + deploy „pustej” strony na Pages — **wcześnie potwierdzony działający deploy** (ryzyko z sekcji 6 analizy).
- Commity: `chore: initial project setup`, `chore: configure eslint, prettier and vitest`, `ci: add lint, build and pages deploy workflow`.

### Faza 2 — Kontrakt danych i logika współdzielona (~60 min)

- [ ] `shared/limits.ts`, `shared/currencies.ts`, `shared/sanitize.ts`.
- [ ] `shared/sentences.ts` — licznik zdań odporny na skróty (B13).
- [ ] `shared/schema.ts` — schematy z sekcji 3.
- [ ] Testy jednostkowe (sekcja 5.1: S-01…S-20).
- Commit: `feat(shared): add analysis schema, limits and sanitizers`, `test: cover schema validation`.

### Faza 3 — Wgrywanie i odczyt PDF (~90 min)

- [ ] `validateFile.ts` (F-01): rozszerzenie, MIME, sygnatura `%PDF-`, `0 < size ≤ 10 MB`, jeden plik.
- [ ] `loadPdf.ts`: `pdfjs-dist` z workerem `?url` (B3), `isEvalSupported: false`, `enableXfa: false`, obsługa `PasswordException`/`InvalidPDFException`.
- [ ] `extractText.ts` (F-02, P14): grupowanie elementów wg linii (Y z tolerancją), sortowanie X, scalanie wyrazów z łącznikiem na końcu linii, `--- Strona N ---`, sanitizacja, limit znaków.
- [ ] `stripRepeated.ts` (P15).
- [ ] `renderPageImage.ts` (P3): strony z tekstem < `OCR_MIN_TEXT_CHARS` → canvas (skala do `OCR_RENDER_MAX_PX`) → JPEG q≈0.75; maks. `MAX_OCR_PAGES`.
- [ ] `injection.ts` (P1): wzorce PL/EN, zwraca listę `{page, excerpt}`.
- [ ] Komponenty: `Dropzone` (drop, klik, Enter/Space, `aria-describedby`, stan „przeciągnij tutaj”), `PrivacyNotice`, `EmptyState`.
- Commity: `feat: add pdf upload with validation`, `feat: extract text layer with pdf.js`, `feat: detect scanned pages for ocr`, `feat: detect prompt injection patterns`.

### Faza 4 — Backend (Cloudflare Worker) (~120 min)

- [ ] `wrangler.toml`: `ALLOWED_ORIGINS`, `GEMINI_MODEL`, `GEMINI_FALLBACK_MODEL`, binding rate limit; `.dev.vars.example`.
- [ ] `index.ts` router: `OPTIONS` (preflight), `POST /api/analyze`, inne → 404/405.
- [ ] `cors.ts` (B6), `guards.ts`: `Content-Type`, `Content-Length ≤ MAX_REQUEST_BYTES` przed parsowaniem, rate limit per `CF-Connecting-IP` → 429 + `Retry-After` (B7).
- [ ] Walidacja body `AnalyzeRequestSchema` → 400.
- [ ] `prompt.ts`:
  - `systemInstruction`: rola, reguły schematu (null/[], bez zgadywania, ISO 8601/4217/639-1, klucze EN, wartości w języku dokumentu, 3–5 zdań, 3–7 punktów), reguły merytoryczne (P4–P13: typ wg dokumentu głównego, aneksy zmieniają umowę, osoby w mianowniku, tylko kwoty dosłowne, bez procentów w `amounts`, bez oceny prawnej), reguły bezpieczeństwa (warstwy 1–3).
  - `buildUserContent()`: dokument w `<document-{nonce}>`, usunięcie wcześniejszych wystąpień znacznika, oznaczenie podejrzanych fragmentów, obrazy stron OCR jako `inlineData` z opisem „Strona N (skan)”.
- [ ] `gemini.ts`: `responseMimeType: 'application/json'` + `responseSchema`, `temperature: 0.1`, timeout, fallback modelu przy 429/503, mapowanie błędów (bez wycieku szczegółów).
- [ ] `analyze.ts`: wywołanie → `JSON.parse` → Zod → `grounding` → `outputGuard` → przy porażce **jedna** ponowna próba z listą błędów (B14) → nadpisanie `fileName`/`pages` (B16) → `meta`.
- [ ] `grounding.ts`: normalizacja liczb PL (`184 500,00`, `184500`, `2 150`) i dat (`12.03.2026`, `12 marca 2026`) → usuwanie nieugruntowanych pozycji + ostrzeżenie (P6, P7).
- [ ] `outputGuard.ts`: wykrycie fraz injection lub n-gramów z podejrzanych fragmentów w `summary`/`keyPoints` (P1).
- [ ] Testy workera (sekcja 5.2).
- [ ] **Użytkownik:** `npx wrangler secret put GEMINI_API_KEY`; potem `npx wrangler deploy`.
- Commity: `feat(worker): add analyze endpoint with cors and limits`, `feat(worker): integrate gemini with structured output`, `feat(worker): add grounding and output guard`, `feat(worker): retry once on invalid ai response`.

### Faza 5 — Integracja front ↔ API i stany UI (~75 min)

- [ ] `analyzeClient.ts`: `fetch(VITE_API_URL)`, `AbortController` + timeout, mapowanie statusów → `AppError`, **ponowna walidacja odpowiedzi Zodem przed wyświetleniem** (F-04).
- [ ] `useAnalysis.ts`: reducer `idle → reading → ocr → analyzing → success | error`; anulowanie przy nowym pliku; `retry()` ponawia od ostatniego kroku z tymi samymi danymi.
- [ ] `ProgressStatus` (F-06): etapy z `aria-live="polite"`, licznik czasu.
- [ ] `ErrorState` (F-06): komunikat PL + „Spróbuj ponownie” + „Wybierz inny plik”.
- Commit: `feat: connect ui to analysis api with loading and error states`.

### Faza 6 — Widok wyniku i eksport (~75 min)

- [ ] `ResultView` + sekcje (F-05); `WarningsBanner` (np. „Wykryto w dokumencie próbę wydania poleceń AI — zignorowano”, „Strona 11 odczytana przez OCR”).
- [ ] `JsonPreview`: `<pre>`, przycisk „Kopiuj”.
- [ ] `DownloadButton` + `download.ts`: bezpieczna nazwa, `Blob`, `revokeObjectURL`.
- [ ] Responsywność od 360 px (tabele → karty), focus ring, kontrast AA, `prefers-reduced-motion`.
- Commit: `feat: add result view with json preview and download`.

### Faza 7 — Historia (F-09) (~30 min)

- [ ] `history.ts`: zapis ostatnich 10 wyników (tylko JSON), odczyt z walidacją Zod (odrzucenie uszkodzonych wpisów), `try/catch` na każdy dostęp do storage.
- [ ] `HistoryPanel`: lista (nazwa, data, typ), „Otwórz”, „Usuń”, „Wyczyść historię”.
- Commit: `feat: persist recent analyses in local storage`.

### Faza 8 — Długie dokumenty (F-08) (~45 min)

- [ ] `chunk.ts`: podział po granicach stron do `CHUNK_CHARS`.
- [ ] Równoległa ekstrakcja fragmentów (limit współbieżności 3) → `merge.ts` (deduplikacja encji/kwot/dat, przycięcie do limitów) → jedno wywołanie „syntezy” podsumowania i `keyPoints` na podstawie wyników fragmentów.
- [ ] `meta.chunks`.
- Commit: `feat(worker): split long documents into chunks and merge results`.

### Faza 9 — Testy E2E i jakość wyników (~90 min)

- [ ] `tests/fixtures/generate.ts` (pdf-lib) — fixture'y z sekcji 5.3.
- [ ] Testy Playwright (sekcja 5.4) na `vite preview` z mockiem API (`page.route`).
- [ ] Testy „live” (tag `@live`, uruchamiane ręcznie, poza CI) — plik testowy z rekrutacji vs oczekiwania z ANALIZA §3.2.
- [ ] Dostrojenie promptu na podstawie wyników live; każda poprawka odnotowana w AI_LOG.
- Commity: `test: add pdf fixtures generator`, `test(e2e): cover upload, states, results and history`, `fix: …` (wg wyników).

### Faza 10 — CI/CD finalnie (~20 min)

- [ ] Workflow: `npm ci` → `lint` → `typecheck` → `test` (unit + worker) → `build` (z `VITE_API_URL` z `vars`) → `playwright test` (mock) → upload artefaktu → `deploy-pages`; `permissions` minimalne; `concurrency` dla Pages.
- [ ] `npm audit --audit-level=high`.
- [ ] Ustawienie Pages na źródło „GitHub Actions” (`gh api`) (B8), zmienna repo `VITE_API_URL`.
- Commit: `ci: run unit and e2e tests before deploy`.

### Faza 11 — Dokumentacja (~45 min, AI_LOG prowadzony na bieżąco)

- [ ] `README.md`: link do demo, zrzut ekranu, diagram, decyzje (sekcja 5 analizy), bezpieczeństwo (warstwy), uruchomienie lokalne (front + `wrangler dev`), zmienne (`VITE_API_URL`, `GEMINI_API_KEY`, `GEMINI_MODEL`, `ALLOWED_ORIGINS`), testy, znane ograniczenia (darmowy tier i dane, limity RPM, maks. stron OCR, brak oceny prawnej, PDF z hasłem nieobsługiwany).
- [ ] `AI_LOG.md`: narzędzia, 3–5 kluczowych promptów, konkretne pomyłki AI i poprawki.
- Commit: `docs: add readme and ai log`.

### Faza 12 — Weryfikacja i oddanie (~30 min)

- [ ] Checklista akceptacyjna (sekcja 6) na produkcji.
- [ ] `gitleaks detect` + `git log -p | grep -i "AIza\|api_key"` — zero trafień (B5).
- [ ] Test w trybie incognito na telefonie (360 px) i na desktopie.
- [ ] Formularz: link do repo → „Link do zadania testowego”, link do demo → „Komentarz do zadania”.

## 5. Plan testów

### 5.1 Unit — `shared/` i `src/lib` (Vitest)

| ID   | Przypadek                                                                                                                           |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------- |
| S-01 | Poprawny wynik (przykład z briefu) przechodzi walidację                                                                             |
| S-02 | Brak wymaganego pola (np. `keywords`) → błąd                                                                                        |
| S-03 | `date` w formacie `12.03.2026` → błąd; `null` → OK                                                                                  |
| S-04 | Nieistniejąca data `2026-02-30` → błąd                                                                                              |
| S-05 | `currency: "zł"` / `"pln"` → błąd; `"PLN"`, `"EUR"`, `"USD"` → OK                                                                   |
| S-06 | `value: "184 500,00"` (string) → błąd                                                                                               |
| S-07 | `type` spoza enum → błąd                                                                                                            |
| S-08 | `language: "pol"` / `"PL"` → błąd                                                                                                   |
| S-09 | `summary` z 2 i 6 zdaniami → błąd; 3 i 5 → OK                                                                                       |
| S-10 | Licznik zdań: „Nordwave Logistics sp. z o.o. zawarła umowę z Kwadrat Software S.A.” = 1 zdanie                                      |
| S-11 | Licznik zdań: daty `12.03.2026 r.`, „ul. Portowa 18”, „nr 14/2026”, „ok. 3 400”, „tj.”                                              |
| S-12 | `keyPoints` 2 i 8 pozycji → błąd                                                                                                    |
| S-13 | Puste stringi / same spacje → błąd                                                                                                  |
| S-14 | Za długie stringi → błąd                                                                                                            |
| S-15 | Sanitizacja: usunięcie `U+202E`, `U+200B`, znaków sterujących; NFC                                                                  |
| S-16 | Dodatkowe pola na najwyższym poziomie są dozwolone (zasada „można dodawać”)                                                         |
| S-17 | `validateFile`: `.txt` przemianowany na `.pdf` (brak `%PDF-`) → `NOT_PDF`                                                           |
| S-18 | `validateFile`: 0 B, 10 MB + 1 B, 2 pliki, zły MIME                                                                                 |
| S-19 | `injection`: wykrywa frazę z pliku testowego; nie wykrywa zwykłego tekstu umowy (brak fałszywych alarmów na „Zamawiający zapłaci…”) |
| S-20 | `history`: uszkodzony JSON / zła struktura w storage → ignorowane; limit 10; brak storage → brak wyjątku                            |
| S-21 | `download`: nazwa `../../<img>‮fdp.exe.pdf` → bezpieczna nazwa                                                                      |
| S-22 | `stripRepeated`: usuwa stopki powtarzane na stronach, zostawia treść                                                                |
| S-23 | `extractText`: scalanie „Go-” + „live”, kolejność linii wg Y/X                                                                      |

### 5.2 Unit — worker (Vitest, `fetch` LLM mockowany)

| ID   | Przypadek                                                                                              |
| ---- | ------------------------------------------------------------------------------------------------------ |
| W-01 | `OPTIONS` z dozwolonego Origin → 204 + nagłówki CORS                                                   |
| W-02 | Niedozwolony Origin → 403, brak nagłówków CORS                                                         |
| W-03 | `GET /api/analyze` → 405; nieznana ścieżka → 404                                                       |
| W-04 | Zły `Content-Type` → 415                                                                               |
| W-05 | `Content-Length` > limit → 413 bez parsowania body                                                     |
| W-06 | Body niezgodne ze schematem (np. 6 obrazów, obraz PNG, tekst > limit) → 400                            |
| W-07 | Przekroczony rate limit → 429 + `Retry-After`                                                          |
| W-08 | Poprawna odpowiedź LLM → 200, `fileName`/`pages` nadpisane wartościami z żądania                       |
| W-09 | Niepoprawny JSON z LLM → dokładnie **jedna** ponowna próba → sukces                                    |
| W-10 | Dwie niepoprawne odpowiedzi → 502 `AI_INVALID` (dokładnie 2 wywołania LLM)                             |
| W-11 | Prompt: dokument jest w bloku z nonce; znacznik zamykający wstrzyknięty w treść zostaje usunięty       |
| W-12 | Prompt: polecenia z dokumentu nie trafiają do `systemInstruction`                                      |
| W-13 | Output guard: summary z „umowa jest nieważna … 1 PLN” → retry                                          |
| W-14 | Grounding: kwota nieobecna w tekście jest usuwana + ostrzeżenie; `184 500,00 zł` ↔ `184500` dopasowane |
| W-15 | Grounding dat: `12 października 2026 r.` ↔ `2026-10-12`                                                |
| W-16 | Timeout LLM → 504; 429 od dostawcy → model zapasowy → sukces                                           |
| W-17 | Chunking: podział po stronach, merge deduplikuje „Anna Kowalczyk” / „ANNA KOWALCZYK”                   |
| W-18 | Odpowiedzi błędów nie zawierają klucza, stack trace ani surowej odpowiedzi modelu                      |

### 5.3 Fixture'y PDF (generowane skryptem, commitowane)

| Plik                                        | Cel                                                       |
| ------------------------------------------- | --------------------------------------------------------- |
| `contract-pl.pdf`                           | Krótka umowa PL z kwotami w PLN/EUR i datami (happy path) |
| `invoice-en.pdf`                            | Faktura EN (język, typ, waluta USD)                       |
| `injection.pdf`                             | Ukryty biały tekst z poleceniem dla AI                    |
| `scanned.pdf`                               | Strona będąca wyłącznie obrazem (OCR)                     |
| `mixed-scan.pdf`                            | Tekst + jedna strona skanu                                |
| `long-120-pages.pdf`                        | Chunking (F-08)                                           |
| `empty.pdf`                                 | Brak tekstu i brak obrazów → komunikat                    |
| `encrypted.pdf`                             | PDF z hasłem → komunikat                                  |
| `corrupted.pdf`                             | Uszkodzona struktura → komunikat                          |
| `fake.pdf`                                  | Plik tekstowy z rozszerzeniem `.pdf`                      |
| `too-big.pdf`                               | > 10 MB (generowany w trakcie testu, nie commitowany)     |
| `xss-name-<img src=x onerror=alert(1)>.pdf` | Złośliwa nazwa pliku (tworzona w teście)                  |

### 5.4 E2E — Playwright (Chromium + Firefox + WebKit; mobile 360×740)

| ID   | Scenariusz                                                                      | Oczekiwanie                                                                                                                             |
| ---- | ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| E-01 | Pierwsze wejście                                                                | Stan pusty, widoczna informacja o przesyłaniu do API AI, brak błędów w konsoli                                                          |
| E-02 | Upload przez „Wybierz plik”                                                     | Etapy ładowania → wynik ze wszystkimi sekcjami                                                                                          |
| E-03 | Upload przez drag & drop (syntetyczne `DataTransfer`)                           | Jak E-02                                                                                                                                |
| E-04 | Tylko klawiatura: Tab → Enter na dropzone → wybór pliku → Tab do „Pobierz JSON” | Cała ścieżka bez myszy, widoczny focus                                                                                                  |
| E-05 | Plik `.txt` / `fake.pdf`                                                        | Komunikat PL „To nie jest prawidłowy plik PDF”, brak żądania do API                                                                     |
| E-06 | Plik > 10 MB                                                                    | Komunikat o limicie, brak żądania do API                                                                                                |
| E-07 | `encrypted.pdf`, `corrupted.pdf`, `empty.pdf`                                   | Odpowiednie komunikaty PL                                                                                                               |
| E-08 | API zwraca 500 → klik „Spróbuj ponownie” → API zwraca 200                       | Stan błędu, potem wynik                                                                                                                 |
| E-09 | API zwraca 429                                                                  | Komunikat o limicie z czasem oczekiwania                                                                                                |
| E-10 | API zwraca JSON niezgodny ze schematem                                          | Błąd walidacji (F-04) — **nic nie jest wyświetlane jako wynik**                                                                         |
| E-11 | API zwraca pola z `<img src=x onerror=…>`, `<script>`, `javascript:`            | Wyświetlone jako tekst; `window.__xss` niezdefiniowane; brak nowych elementów `img`/`script`                                            |
| E-12 | Złośliwa nazwa pliku                                                            | Wyświetlona jako tekst; pobrany plik ma bezpieczną nazwę                                                                                |
| E-13 | Pobranie JSON                                                                   | Pobrany plik przechodzi `AnalysisResultSchema` i zawiera dane z widoku                                                                  |
| E-14 | Podgląd JSON                                                                    | `<pre>` zawiera poprawny, sformatowany JSON                                                                                             |
| E-15 | Historia                                                                        | Po przeładowaniu wynik jest na liście; „Otwórz” pokazuje go bez wywołania API; „Wyczyść” usuwa                                          |
| E-16 | Zmanipulowany `localStorage`                                                    | Aplikacja działa, uszkodzone wpisy pominięte                                                                                            |
| E-17 | `injection.pdf` (mock sprawdza body żądania)                                    | Żądanie zawiera `suspectedInjection`; UI pokazuje baner ostrzeżenia                                                                     |
| E-18 | `scanned.pdf`                                                                   | Żądanie zawiera obraz strony; status „OCR strony 1”                                                                                     |
| E-19 | Wgranie nowego pliku w trakcie analizy                                          | Poprzednie żądanie anulowane, pokazany wynik nowego                                                                                     |
| E-20 | Viewport 360 px                                                                 | Brak poziomego przewijania, wszystkie akcje dostępne                                                                                    |
| E-21 | axe-core na stanach: pusty, ładowanie, błąd, wynik                              | Zero naruszeń `serious`/`critical`                                                                                                      |
| E-22 | CSP                                                                             | Brak naruszeń CSP w konsoli; pdf.js worker ładuje się z `base` (B3)                                                                     |
| E-23 | `@live` produkcja + plik testowy z rekrutacji                                   | < 30 s; `type=umowa`, `date=2026-03-12`, `pages=12`, waluty PLN/EUR/USD, podsumowanie bez „nieważna”/„1 PLN”, kwota 13 100 PLN z aneksu |
| E-24 | `@live` produkcja                                                               | Strona ładuje się pod `/pdf-insight/`, assety bez 404                                                                                   |

## 6. Checklista akceptacyjna (przed oddaniem)

- [ ] F-01…F-07 działają na produkcji w incognito (desktop + 360 px).
- [ ] Plik testowy: < 30 s, wynik zgodny z ANALIZA §3.2, injection zignorowane, aneks (OCR) uwzględniony.
- [ ] Pobrany JSON przechodzi walidację schematu.
- [ ] `npm run check` zielone; CI zielone; zero `any`/`console`.
- [ ] Zero sekretów w repo i historii (gitleaks).
- [ ] CORS: żądanie z innego Origin → 403.
- [ ] Rate limit działa (11. żądanie w minucie → 429).
- [ ] README + AI_LOG kompletne; zrzut ekranu aktualny.
- [ ] Historia commitów: kilka logicznych commitów w konwencji.

## 7. Harmonogram orientacyjny

| Blok                   | Fazy                        | Czas                 |
| ---------------------- | --------------------------- | -------------------- |
| Start                  | 0–1 (+ pierwszy deploy)     | ~1 h                 |
| Rdzeń                  | 2–6 (MUST + bezpieczeństwo) | ~7 h                 |
| Rozszerzenia           | 7–8 (historia, chunking)    | ~1,5 h               |
| Testy i CI             | 9–10                        | ~2 h                 |
| Dokumentacja i oddanie | 11–12                       | ~1,25 h              |
| **Razem**              |                             | **~12–13 h** + bufor |

Jeśli czas się kurczy, tniemy w kolejności: chunking (F-08) → testy wielu przeglądarek (zostaje Chromium + mobile) → historia (F-09). MUST, bezpieczeństwo i OCR aneksu zostają nienaruszone.

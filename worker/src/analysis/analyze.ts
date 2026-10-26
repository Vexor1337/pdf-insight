import type { AnalyzeRequest } from '../../../shared/api.ts';
import { neutralizeInjections, type SuspectedInjection } from '../../../shared/injection.ts';
import { CHUNK_CHARS } from '../../../shared/limits.ts';
import type { AnalysisResult } from '../../../shared/schema.ts';
import { mapWithConcurrency } from '../concurrency.ts';
import { ServiceError } from '../errors.ts';
import type { GeminiClient } from '../llm/gemini.ts';
import { buildAnalysisInstruction, buildDocumentParts, type DocumentPage } from '../llm/prompt.ts';
import { ANALYSIS_RESPONSE_SCHEMA } from '../llm/responseSchemas.ts';
import { chunkPages } from './chunk.ts';
import { composeResult, tidyAnalysis, type ResultContext } from './composeResult.ts';
import { groundAnalysis } from './grounding.ts';
import { mergeExtracted } from './merge.ts';
import { ModelAnalysisSchema, parseModelJson, type ModelAnalysis } from './modelOutput.ts';
import { transcribePages } from './ocr.ts';
import { findInjectionEcho } from './outputGuard.ts';
import { requestValidated, type Validation } from './validatedRequest.ts';

const ANALYSIS_MAX_OUTPUT_TOKENS = 16_384;
const CHUNK_CONCURRENCY = 3;

export interface AnalyzeDeps {
  analysisClient: GeminiClient;
  ocrClient: GeminiClient;
  createNonce: () => string;
  now: () => Date;
}

interface AnalysisInput {
  pages: readonly DocumentPage[];
  injections: readonly SuspectedInjection[];
  context: ResultContext;
}

function validateAnalysis(raw: string, input: AnalysisInput): Validation<ModelAnalysis> {
  const parsed = parseModelJson(ModelAnalysisSchema, raw);
  if (!parsed.ok) return parsed;
  const analysis = tidyAnalysis(parsed.data);
  const composed = composeResult(analysis, input.context);
  const echo = findInjectionEcho(analysis, input.injections);
  const problems = [...(composed.ok ? [] : composed.problems), ...(echo ? [echo] : [])];
  return problems.length > 0 ? { ok: false, problems } : { ok: true, data: analysis };
}

async function analyzePages(input: AnalysisInput, deps: AnalyzeDeps) {
  const nonce = deps.createNonce();
  return requestValidated(
    deps.analysisClient,
    {
      systemInstruction: buildAnalysisInstruction(nonce),
      parts: buildDocumentParts(input.pages, nonce),
      responseSchema: ANALYSIS_RESPONSE_SCHEMA,
      maxOutputTokens: ANALYSIS_MAX_OUTPUT_TOKENS,
      thinkingLevel: 'low',
    },
    (raw) => validateAnalysis(raw, input),
  );
}

async function analyzeLongDocument(
  chunks: readonly DocumentPage[][],
  input: AnalysisInput,
  deps: AnalyzeDeps,
) {
  const partials = await mapWithConcurrency(chunks, CHUNK_CONCURRENCY, (pages) =>
    analyzePages({ ...input, pages }, deps),
  );
  const digest = partials.map(({ data }, index) => ({
    page: index + 1,
    text: JSON.stringify({
      document: data.document,
      summary: data.summary,
      keyPoints: data.keyPoints,
    }),
  }));
  const synthesis = await analyzePages({ ...input, pages: digest }, deps);
  const merged = mergeExtracted(partials.map(({ data }) => data));
  return { data: { ...synthesis.data, ...merged }, model: synthesis.model };
}

async function withOcr(request: AnalyzeRequest, deps: AnalyzeDeps) {
  if (request.images.length === 0) return { pages: request.pagesText, ocrPages: [], warnings: [] };
  try {
    const transcribed = await transcribePages(deps.ocrClient, request.images);
    const byPage = new Map(transcribed.map((page) => [page.page, page.text]));
    const pages = request.pagesText.map((page) => ({
      page: page.page,
      text: byPage.get(page.page) ?? page.text,
    }));
    return { pages, ocrPages: transcribed.map((page) => page.page), warnings: [] };
  } catch {
    return {
      pages: request.pagesText,
      ocrPages: [],
      warnings: ['Nie udało się odczytać zeskanowanych stron — wynik pomija ich treść.'],
    };
  }
}

function injectionWarnings(injections: readonly SuspectedInjection[]): string[] {
  return injections.map(
    ({ page }) =>
      `Strona ${page}: usunięto fragment wyglądający na polecenie dla AI (próba manipulacji).`,
  );
}

export async function analyzeDocument(
  request: AnalyzeRequest,
  deps: AnalyzeDeps,
): Promise<AnalysisResult> {
  const ocr = await withOcr(request, deps);
  const neutralized = ocr.pages.map((page) => neutralizeInjections(page.page, page.text));
  const pages = neutralized.map(({ page, text }) => ({ page, text }));
  if (pages.every((page) => page.text.trim() === '')) throw new ServiceError('BAD_REQUEST');

  const chunks = chunkPages(pages, CHUNK_CHARS);
  const injections = neutralized.flatMap((page) => page.injections);
  const meta = {
    model: 'pending',
    generatedAt: deps.now().toISOString(),
    ocrPages: ocr.ocrPages,
    chunks: chunks.length,
    warnings: [...injectionWarnings(injections), ...ocr.warnings],
  };
  const input: AnalysisInput = {
    pages,
    injections,
    context: { fileName: request.fileName, pages: request.pages, meta },
  };

  const { data, model } =
    chunks.length > 1
      ? await analyzeLongDocument(chunks, input, deps)
      : await analyzePages(input, deps);

  const deduplicated = { ...data, ...mergeExtracted([data]) };
  const grounded = groundAnalysis(deduplicated, pages.map((page) => page.text).join('\n'));
  const result = composeResult(grounded.analysis, {
    ...input.context,
    meta: { ...meta, model, warnings: [...meta.warnings, ...grounded.warnings] },
  });
  if (!result.ok) throw new ServiceError('AI_INVALID_RESPONSE');
  return result.data;
}

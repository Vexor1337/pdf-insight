import { isIso4217 } from '../../../shared/currencies.ts';
import { KEY_POINTS } from '../../../shared/limits.ts';
import { AnalysisResultSchema, type AnalysisResult } from '../../../shared/schema.ts';
import type { ModelAnalysis } from './modelOutput.ts';
import { toProblems, type Validation } from './validatedRequest.ts';

export interface ResultContext {
  fileName: string;
  pages: number;
  meta: AnalysisResult['meta'];
}

export function tidyAnalysis(analysis: ModelAnalysis): ModelAnalysis {
  return {
    ...analysis,
    keyPoints: analysis.keyPoints.slice(0, KEY_POINTS.max),
    amounts: analysis.amounts.filter((amount) => isIso4217(amount.currency)),
  };
}

export function composeResult(
  analysis: ModelAnalysis,
  context: ResultContext,
): Validation<AnalysisResult> {
  const parsed = AnalysisResultSchema.safeParse({
    document: { fileName: context.fileName, pages: context.pages, ...analysis.document },
    summary: analysis.summary,
    keyPoints: analysis.keyPoints,
    entities: analysis.entities,
    amounts: analysis.amounts,
    dates: analysis.dates,
    keywords: analysis.keywords,
    meta: context.meta,
  });
  return parsed.success
    ? { ok: true, data: parsed.data }
    : { ok: false, problems: toProblems(parsed.error) };
}

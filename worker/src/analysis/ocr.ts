import type { AnalyzeRequest } from '../../../shared/api.ts';
import { sanitizeText } from '../../../shared/sanitize.ts';
import type { GeminiClient, Part } from '../llm/gemini.ts';
import { buildOcrInstruction, type DocumentPage } from '../llm/prompt.ts';
import { OCR_RESPONSE_SCHEMA } from '../llm/responseSchemas.ts';
import { OcrOutputSchema, parseModelJson } from './modelOutput.ts';
import { requestValidated } from './validatedRequest.ts';

const OCR_MAX_OUTPUT_TOKENS = 16_384;

export async function transcribePages(
  client: GeminiClient,
  images: AnalyzeRequest['images'],
): Promise<DocumentPage[]> {
  const requested = new Set(images.map((image) => image.page));
  const parts: Part[] = images.flatMap((image) => [
    { text: `Strona ${image.page}:` },
    { inlineData: { mimeType: image.mimeType, data: image.dataBase64 } },
  ]);

  const { data } = await requestValidated(
    client,
    {
      systemInstruction: buildOcrInstruction(),
      parts,
      responseSchema: OCR_RESPONSE_SCHEMA,
      maxOutputTokens: OCR_MAX_OUTPUT_TOKENS,
      thinkingLevel: 'minimal',
    },
    (raw) => parseModelJson(OcrOutputSchema, raw),
  );

  return data.pages
    .filter((page) => requested.has(page.page))
    .map((page) => ({ page: page.page, text: sanitizeText(page.text).trim() }));
}

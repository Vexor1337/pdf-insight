import { z } from 'zod';
import {
  MAX_FILE_NAME_CHARS,
  MAX_IMAGE_BASE64_CHARS,
  MAX_OCR_PAGES,
  MAX_PAGES,
  MAX_TEXT_CHARS,
} from './limits.ts';
import { AnalysisResultSchema } from './schema.ts';

const pageNumber = z.number().int().min(1).max(MAX_PAGES);
const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

export const AnalyzeRequestSchema = z
  .object({
    fileName: z.string().min(1).max(MAX_FILE_NAME_CHARS),
    pages: pageNumber,
    pagesText: z.array(z.object({ page: pageNumber, text: z.string() })).max(MAX_PAGES),
    images: z
      .array(
        z.object({
          page: pageNumber,
          mimeType: z.literal('image/jpeg'),
          dataBase64: z.string().min(1).max(MAX_IMAGE_BASE64_CHARS).regex(BASE64),
        }),
      )
      .max(MAX_OCR_PAGES),
  })
  .strict()
  .refine(
    (body) => body.pagesText.reduce((sum, page) => sum + page.text.length, 0) <= MAX_TEXT_CHARS,
    'Dokument zawiera zbyt dużo tekstu.',
  )
  .refine(
    (body) =>
      [...body.pagesText, ...body.images].every((item) => item.page <= body.pages) &&
      new Set(body.pagesText.map((item) => item.page)).size === body.pagesText.length &&
      new Set(body.images.map((item) => item.page)).size === body.images.length,
    'Numery stron są niespójne.',
  )
  .refine(
    (body) => body.pagesText.some((page) => page.text.trim() !== '') || body.images.length > 0,
    'Dokument nie zawiera tekstu ani stron do OCR.',
  );

export type AnalyzeRequest = z.infer<typeof AnalyzeRequestSchema>;

const ERROR_CODES = [
  'BAD_REQUEST',
  'FORBIDDEN_ORIGIN',
  'NOT_FOUND',
  'METHOD_NOT_ALLOWED',
  'PAYLOAD_TOO_LARGE',
  'UNSUPPORTED_MEDIA_TYPE',
  'RATE_LIMITED',
  'AI_INVALID_RESPONSE',
  'AI_UNAVAILABLE',
  'AI_TIMEOUT',
  'INTERNAL',
] as const;

export type ApiErrorCode = (typeof ERROR_CODES)[number];

export const AnalyzeSuccessSchema = z.object({ result: AnalysisResultSchema });
export const ApiErrorSchema = z.object({
  error: z.object({ code: z.enum(ERROR_CODES), message: z.string().max(500) }),
});

export type ApiError = z.infer<typeof ApiErrorSchema>;

import type { z } from 'zod';
import { ServiceError } from '../errors.ts';
import type { GeminiClient, JsonRequest } from '../llm/gemini.ts';
import { retryPart } from '../llm/prompt.ts';

export type Validation<T> = { ok: true; data: T } | { ok: false; problems: string[] };

const MAX_ATTEMPTS = 2;
const MAX_REPORTED_PROBLEMS = 10;

export function toProblems(error: z.ZodError): string[] {
  return error.issues
    .slice(0, MAX_REPORTED_PROBLEMS)
    .map((issue) => `${issue.path.join('.')}: ${issue.message}`);
}

export async function requestValidated<T>(
  client: GeminiClient,
  request: JsonRequest,
  validate: (raw: string) => Validation<T>,
): Promise<{ data: T; model: string }> {
  let parts = request.parts;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const { text, model } = await client.generateJson({ ...request, parts });
    const result = validate(text);
    if (result.ok) return { data: result.data, model };
    parts = [...request.parts, retryPart(result.problems)];
  }
  throw new ServiceError('AI_INVALID_RESPONSE');
}

import { AnalyzeRequestSchema } from '../../shared/api.ts';
import type { AnalysisResult } from '../../shared/schema.ts';
import { MAX_REQUEST_BYTES } from '../../shared/limits.ts';
import { analyzeDocument, type AnalyzeDeps } from './analysis/analyze.ts';
import { parseList } from './config.ts';
import type { Env } from './env.ts';
import { corsHeaders, parseAllowedOrigins } from './http/cors.ts';
import { ServiceError } from './errors.ts';
import { errorResponse, jsonResponse } from './http/responses.ts';
import { createGeminiClient } from './llm/gemini.ts';
import { createNonce } from './llm/prompt.ts';

const ANALYZE_PATH = '/api/analyze';

async function readJsonBody(request: Request): Promise<unknown> {
  if (!request.headers.get('Content-Type')?.toLowerCase().startsWith('application/json')) {
    throw new ServiceError('UNSUPPORTED_MEDIA_TYPE');
  }
  const declared = Number(request.headers.get('Content-Length') ?? 'NaN');
  if (Number.isFinite(declared) && declared > MAX_REQUEST_BYTES) {
    throw new ServiceError('PAYLOAD_TOO_LARGE');
  }

  const body = await request.arrayBuffer();
  if (body.byteLength > MAX_REQUEST_BYTES) throw new ServiceError('PAYLOAD_TOO_LARGE');
  try {
    return JSON.parse(new TextDecoder().decode(body));
  } catch (error) {
    throw new ServiceError('BAD_REQUEST', { cause: error });
  }
}

export function createDeps(env: Env): AnalyzeDeps {
  const apiKey = env.GEMINI_API_KEY.trim();
  return {
    analysisClient: createGeminiClient({
      apiKey,
      models: parseList(env.GEMINI_MODELS),
    }),
    ocrClient: createGeminiClient({
      apiKey,
      models: parseList(env.GEMINI_OCR_MODELS),
    }),
    createNonce,
    now: () => new Date(),
  };
}

async function handleAnalyze(
  request: Request,
  env: Env,
  deps: AnalyzeDeps,
): Promise<AnalysisResult> {
  const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
  const [perClient, overall] = await Promise.all([
    env.RATE_LIMITER.limit({ key: ip }),
    env.GLOBAL_RATE_LIMITER.limit({ key: 'global' }),
  ]);
  if (!perClient.success || !overall.success) throw new ServiceError('RATE_LIMITED');

  const parsed = AnalyzeRequestSchema.safeParse(await readJsonBody(request));
  if (!parsed.success) throw new ServiceError('BAD_REQUEST');

  return analyzeDocument(parsed.data, deps);
}

export async function handleRequest(
  request: Request,
  env: Env,
  deps: AnalyzeDeps = createDeps(env),
): Promise<Response> {
  const url = new URL(request.url);
  if (url.pathname !== ANALYZE_PATH) return errorResponse('NOT_FOUND');

  const cors = corsHeaders(request.headers.get('Origin'), parseAllowedOrigins(env.ALLOWED_ORIGINS));
  if (!cors) return errorResponse('FORBIDDEN_ORIGIN');
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (request.method !== 'POST') {
    return errorResponse('METHOD_NOT_ALLOWED', { ...cors, Allow: 'POST, OPTIONS' });
  }

  try {
    const result = await handleAnalyze(request, env, deps);
    return jsonResponse({ result }, 200, cors);
  } catch (error) {
    if (error instanceof ServiceError) {
      const retryAfter: Record<string, string> =
        error.code === 'RATE_LIMITED' ? { 'Retry-After': '60' } : {};
      return errorResponse(error.code, { ...cors, ...retryAfter });
    }
    return errorResponse('INTERNAL', cors);
  }
}

export default {
  fetch: (request, env) => handleRequest(request, env),
} satisfies ExportedHandler<Env>;

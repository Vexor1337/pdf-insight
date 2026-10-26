import { ServiceError } from '../errors.ts';

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const REQUEST_TIMEOUT_MS = 25_000;
const TIMEOUT_STATUS = 408;
const FALLBACK_STATUSES = new Set([TIMEOUT_STATUS, 429, 500, 503, 504]);
const TRANSIENT_STATUSES = new Set([500, 503, 504]);
const TRANSIENT_RETRY_DELAY_MS = 700;

export type Part = { text: string } | { inlineData: { mimeType: string; data: string } };

/** "minimal" suits mechanical tasks such as OCR; "low" leaves room for reasoning in analysis. */
export type ThinkingLevel = 'minimal' | 'low';

export interface JsonRequest {
  systemInstruction: string;
  parts: Part[];
  responseSchema: object;
  maxOutputTokens: number;
  thinkingLevel: ThinkingLevel;
}

export interface GeminiClient {
  /** Returns the model's raw JSON text and the model that produced it. */
  generateJson(request: JsonRequest): Promise<{ text: string; model: string }>;
}

interface GeminiConfig {
  apiKey: string;
  models: readonly string[];
  fetchFn?: typeof fetch;
  timeoutMs?: number;
  retryDelayMs?: number;
}

interface GenerateContentResponse {
  candidates?: {
    content?: { parts?: { text?: string; thought?: boolean }[] };
    finishReason?: string;
  }[];
  promptFeedback?: { blockReason?: string };
}

function buildBody(request: JsonRequest): string {
  return JSON.stringify({
    systemInstruction: { parts: [{ text: request.systemInstruction }] },
    contents: [{ role: 'user', parts: request.parts }],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: request.maxOutputTokens,
      responseMimeType: 'application/json',
      responseJsonSchema: request.responseSchema,
      thinkingConfig: { thinkingLevel: request.thinkingLevel },
    },
  });
}

function extractText(data: GenerateContentResponse): string {
  if (data.promptFeedback?.blockReason) throw new ServiceError('AI_INVALID_RESPONSE');
  const parts = data.candidates?.[0]?.content?.parts ?? [];
  const text = parts
    .filter((part) => !part.thought)
    .map((part) => part.text ?? '')
    .join('');
  if (!text) throw new ServiceError('AI_INVALID_RESPONSE');
  return text;
}

class ProviderStatusError extends Error {
  constructor(readonly status: number) {
    super(`Provider responded with ${status}`);
  }
}

async function callModel(config: GeminiConfig, model: string, body: string): Promise<string> {
  const fetchFn = config.fetchFn ?? fetch;
  let response: Response;
  try {
    response = await fetchFn(`${API_BASE}/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': config.apiKey },
      body,
      signal: AbortSignal.timeout(config.timeoutMs ?? REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    const isTimeout = error instanceof DOMException && error.name === 'TimeoutError';
    if (isTimeout) throw new ProviderStatusError(TIMEOUT_STATUS);
    throw new ServiceError('AI_UNAVAILABLE', { cause: error });
  }
  if (!response.ok) throw new ProviderStatusError(response.status);
  return extractText(await response.json<GenerateContentResponse>());
}

const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

async function callWithRetry(config: GeminiConfig, model: string, body: string): Promise<string> {
  try {
    return await callModel(config, model, body);
  } catch (error) {
    if (!(error instanceof ProviderStatusError) || !TRANSIENT_STATUSES.has(error.status))
      throw error;
    await sleep(config.retryDelayMs ?? TRANSIENT_RETRY_DELAY_MS);
    return callModel(config, model, body);
  }
}

export function createGeminiClient(config: GeminiConfig): GeminiClient {
  return {
    async generateJson(request) {
      const body = buildBody(request);
      let lastStatus = 0;
      for (const model of config.models) {
        try {
          return { text: await callWithRetry(config, model, body), model };
        } catch (error) {
          if (!(error instanceof ProviderStatusError)) throw error;
          lastStatus = error.status;
          if (!FALLBACK_STATUSES.has(error.status)) break;
        }
      }
      throw new ServiceError(lastStatus === TIMEOUT_STATUS ? 'AI_TIMEOUT' : 'AI_UNAVAILABLE');
    },
  };
}

import { describe, expect, it, vi } from 'vitest';
import { createGeminiClient, type JsonRequest } from '../src/llm/gemini.ts';

const REQUEST: JsonRequest = {
  systemInstruction: 'rules',
  parts: [{ text: 'document' }],
  responseSchema: { type: 'object' },
  maxOutputTokens: 100,
  thinkingLevel: 'low',
};

function geminiResponse(text: string, status = 200): Response {
  return new Response(
    JSON.stringify({
      candidates: [{ content: { parts: [{ text: 'thinking…', thought: true }, { text }] } }],
    }),
    { status },
  );
}

describe('Gemini client', () => {
  it('sends the key in a header, never in the URL, and requests structured JSON', async () => {
    const fetchFn = vi.fn<typeof fetch>(() => Promise.resolve(geminiResponse('{"a":1}')));
    const client = createGeminiClient({ apiKey: 'secret', models: ['model-a'], fetchFn });

    const answer = await client.generateJson(REQUEST);

    expect(answer).toEqual({ text: '{"a":1}', model: 'model-a' });
    const [input, init] = fetchFn.mock.calls[0] ?? [];
    const url = input as string;
    expect(url).not.toContain('secret');
    expect(url).toContain('/models/model-a:generateContent');
    expect(new Headers(init?.headers).get('x-goog-api-key')).toBe('secret');
    const body = JSON.parse(init?.body as string) as {
      systemInstruction: unknown;
      generationConfig: Record<string, unknown>;
    };
    expect(body.systemInstruction).toEqual({ parts: [{ text: 'rules' }] });
    expect(body.generationConfig.responseMimeType).toBe('application/json');
    expect(body.generationConfig.responseJsonSchema).toEqual({ type: 'object' });
  });

  it('falls back to the next model on 429 and 503', async () => {
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response('{}', { status: 429 }))
      .mockResolvedValueOnce(geminiResponse('{"ok":true}'));
    const client = createGeminiClient({ apiKey: 'k', models: ['main', 'backup'], fetchFn });

    expect(await client.generateJson(REQUEST)).toEqual({ text: '{"ok":true}', model: 'backup' });
  });

  it('retries the same model once on a transient 503 before falling back', async () => {
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response('{}', { status: 503 }))
      .mockResolvedValueOnce(geminiResponse('{"ok":true}'));
    const client = createGeminiClient({
      apiKey: 'k',
      models: ['main', 'backup'],
      fetchFn,
      retryDelayMs: 0,
    });

    expect(await client.generateJson(REQUEST)).toEqual({ text: '{"ok":true}', model: 'main' });
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('walks the whole model chain when every model is overloaded', async () => {
    const fetchFn = vi.fn<typeof fetch>(() => Promise.resolve(new Response('{}', { status: 503 })));
    const client = createGeminiClient({
      apiKey: 'k',
      models: ['a', 'b', 'c'],
      fetchFn,
      retryDelayMs: 0,
    });

    await expect(client.generateJson(REQUEST)).rejects.toMatchObject({ code: 'AI_UNAVAILABLE' });
    expect(fetchFn).toHaveBeenCalledTimes(6);
  });

  it('does not fall back on client errors such as 400', async () => {
    const fetchFn = vi.fn<typeof fetch>(() => Promise.resolve(new Response('{}', { status: 400 })));
    const client = createGeminiClient({ apiKey: 'k', models: ['main', 'backup'], fetchFn });

    await expect(client.generateJson(REQUEST)).rejects.toMatchObject({ code: 'AI_UNAVAILABLE' });
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('moves to the next model when a model times out', async () => {
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new DOMException('timed out', 'TimeoutError'))
      .mockResolvedValueOnce(geminiResponse('{"ok":true}'));
    const client = createGeminiClient({ apiKey: 'k', models: ['slow', 'fast'], fetchFn });

    expect(await client.generateJson(REQUEST)).toEqual({ text: '{"ok":true}', model: 'fast' });
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('maps a timeout to AI_TIMEOUT', async () => {
    const fetchFn = vi.fn<typeof fetch>(() =>
      Promise.reject(new DOMException('timed out', 'TimeoutError')),
    );
    const client = createGeminiClient({ apiKey: 'k', models: ['main'], fetchFn });
    await expect(client.generateJson(REQUEST)).rejects.toMatchObject({ code: 'AI_TIMEOUT' });
  });

  it('treats a blocked prompt or empty answer as an invalid response', async () => {
    const blocked = new Response(JSON.stringify({ promptFeedback: { blockReason: 'SAFETY' } }));
    const client = createGeminiClient({
      apiKey: 'k',
      models: ['main'],
      fetchFn: () => Promise.resolve(blocked),
    });
    await expect(client.generateJson(REQUEST)).rejects.toMatchObject({
      code: 'AI_INVALID_RESPONSE',
    });
  });
});

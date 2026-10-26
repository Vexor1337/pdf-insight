import { parseList } from '../config.ts';

export function parseAllowedOrigins(value: string): Set<string> {
  return new Set(parseList(value));
}

export function corsHeaders(
  origin: string | null,
  allowed: Set<string>,
): Record<string, string> | null {
  if (!origin || !allowed.has(origin)) return null;
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Expose-Headers': 'Retry-After',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

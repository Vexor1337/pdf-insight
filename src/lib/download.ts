import { sanitizeLine } from '../../shared/sanitize.ts';
import type { AnalysisResult } from '../../shared/schema.ts';

const MAX_BASE_NAME_CHARS = 80;

export function safeDownloadName(originalName: string): string {
  const base = sanitizeLine(originalName)
    .replace(/\.pdf$/i, '')
    .replace(/[^\p{L}\p{N}_-]+/gu, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, MAX_BASE_NAME_CHARS);
  return `${base || 'dokument'}.insight.json`;
}

export function resultToJson(result: AnalysisResult): string {
  return JSON.stringify(result, null, 2);
}

export function downloadResult(result: AnalysisResult): void {
  const blob = new Blob([resultToJson(result)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = safeDownloadName(result.document.fileName);
  link.rel = 'noopener';
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 0);
}

import type { DocumentPage } from '../llm/prompt.ts';

export function chunkPages(pages: readonly DocumentPage[], maxChars: number): DocumentPage[][] {
  const chunks: DocumentPage[][] = [];
  let current: DocumentPage[] = [];
  let size = 0;

  const flush = () => {
    if (current.length > 0) chunks.push(current);
    current = [];
    size = 0;
  };

  for (const page of pages) {
    for (let offset = 0; offset < Math.max(page.text.length, 1); offset += maxChars) {
      const part = { page: page.page, text: page.text.slice(offset, offset + maxChars) };
      if (size + part.text.length > maxChars) flush();
      current.push(part);
      size += part.text.length;
    }
  }
  flush();
  return chunks;
}

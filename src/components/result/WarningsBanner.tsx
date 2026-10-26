import type { AnalysisResult } from '../../../shared/schema.ts';

export function WarningsBanner({ meta }: { meta: AnalysisResult['meta'] }) {
  const notes = [
    ...(meta.ocrPages.length > 0
      ? [`Strony odczytane przez OCR (skany): ${meta.ocrPages.join(', ')}.`]
      : []),
    ...meta.warnings,
  ];
  if (notes.length === 0) return null;

  return (
    <aside className="warnings" aria-label="Uwagi do analizy" data-testid="warnings">
      <h3>Uwagi do analizy</h3>
      <ul>
        {notes.map((note, index) => (
          <li key={`${String(index)}-${note}`}>{note}</li>
        ))}
      </ul>
    </aside>
  );
}

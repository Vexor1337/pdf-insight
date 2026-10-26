import type { AnalysisResult } from '../../../shared/schema.ts';
import { documentTypeLabel, formatIsoDate, languageLabel } from '../../lib/format.ts';

export function DocumentCard({ document }: { document: AnalysisResult['document'] }) {
  return (
    <header className="doc-card">
      <p className="doc-card__type">{documentTypeLabel(document.type)}</p>
      <h2 className="doc-card__title">{document.title ?? 'Dokument bez tytułu'}</h2>
      <dl className="doc-card__meta">
        <div>
          <dt>Plik</dt>
          <dd className="break-anywhere">{document.fileName}</dd>
        </div>
        <div>
          <dt>Strony</dt>
          <dd>{document.pages}</dd>
        </div>
        <div>
          <dt>Język</dt>
          <dd>{languageLabel(document.language)}</dd>
        </div>
        <div>
          <dt>Data dokumentu</dt>
          <dd>{document.date ? formatIsoDate(document.date) : 'brak'}</dd>
        </div>
      </dl>
    </header>
  );
}

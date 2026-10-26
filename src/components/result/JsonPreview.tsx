import { useState } from 'react';
import type { AnalysisResult } from '../../../shared/schema.ts';
import { downloadResult, resultToJson, safeDownloadName } from '../../lib/download.ts';

export function JsonPreview({ result }: { result: AnalysisResult }) {
  const [copied, setCopied] = useState(false);
  const json = resultToJson(result);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(json);
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <section className="result-section" aria-labelledby="json-title">
      <div className="json-header">
        <h3 id="json-title">Dane JSON</h3>
        <div className="actions">
          <button
            type="button"
            className="button button--primary"
            onClick={() => {
              downloadResult(result);
            }}
          >
            Pobierz {safeDownloadName(result.document.fileName)}
          </button>
          <button type="button" className="button" onClick={() => void copy()}>
            {copied ? 'Skopiowano' : 'Kopiuj JSON'}
          </button>
        </div>
      </div>
      <details className="json-details">
        <summary>Pokaż podgląd JSON</summary>
        <pre
          className="json-preview"
          role="region"
          tabIndex={0}
          aria-label="Podgląd JSON"
          data-testid="json-preview"
        >
          {json}
        </pre>
      </details>
      <span className="visually-hidden" role="status" aria-live="polite">
        {copied ? 'Skopiowano JSON do schowka' : ''}
      </span>
    </section>
  );
}

import type { HistoryEntry } from '../lib/history.ts';
import { documentTypeLabel, formatDateTime } from '../lib/format.ts';

interface HistoryPanelProps {
  entries: readonly HistoryEntry[];
  onOpen: (entry: HistoryEntry) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
}

export function HistoryPanel({ entries, onOpen, onRemove, onClear }: HistoryPanelProps) {
  return (
    <section className="panel history" aria-labelledby="history-title">
      <div className="history__header">
        <h2 id="history-title">Historia analiz</h2>
        {entries.length > 0 && (
          <button type="button" className="button button--small" onClick={onClear}>
            Wyczyść
          </button>
        )}
      </div>
      {entries.length === 0 ? (
        <p className="muted">
          Tutaj pojawią się ostatnie wyniki (zapisywane tylko w tej przeglądarce).
        </p>
      ) : (
        <ul className="history__list">
          {entries.map((entry) => (
            <li key={entry.id} className="history__item">
              <button
                type="button"
                className="history__open"
                onClick={() => {
                  onOpen(entry);
                }}
              >
                <span className="history__name break-anywhere">
                  {entry.result.document.fileName}
                </span>
                <span className="muted">
                  {documentTypeLabel(entry.result.document.type)} · {formatDateTime(entry.savedAt)}
                </span>
              </button>
              <button
                type="button"
                className="button button--small button--ghost"
                aria-label={`Usuń z historii: ${entry.result.document.fileName}`}
                onClick={() => {
                  onRemove(entry.id);
                }}
              >
                Usuń
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

import type { ReactNode } from 'react';
import type { AnalysisResult } from '../../../shared/schema.ts';
import { formatAmount, formatIsoDate } from '../../lib/format.ts';

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section className="result-section" aria-labelledby={id}>
      <h3 id={id}>{title}</h3>
      {children}
    </section>
  );
}

function Empty() {
  return <p className="muted">Brak danych w dokumencie.</p>;
}

export function SummarySection({ summary }: { summary: string }) {
  return (
    <Section id="summary-title" title="Podsumowanie">
      <p className="summary">{summary}</p>
    </Section>
  );
}

export function KeyPointsSection({ keyPoints }: { keyPoints: readonly string[] }) {
  return (
    <Section id="keypoints-title" title="Najważniejsze punkty">
      <ul className="bullets">
        {keyPoints.map((point, index) => (
          <li key={`${String(index)}-${point}`}>{point}</li>
        ))}
      </ul>
    </Section>
  );
}

export function AmountsSection({ amounts }: { amounts: AnalysisResult['amounts'] }) {
  return (
    <Section id="amounts-title" title="Kwoty">
      {amounts.length === 0 ? (
        <Empty />
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th scope="col">Kwota</th>
              <th scope="col">Dotyczy</th>
            </tr>
          </thead>
          <tbody>
            {amounts.map((amount, index) => (
              <tr key={`${String(index)}-${String(amount.value)}`}>
                <td data-label="Kwota" className="nowrap">
                  {formatAmount(amount.value, amount.currency)}
                </td>
                <td data-label="Dotyczy">{amount.context}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Section>
  );
}

export function DatesSection({ dates }: { dates: AnalysisResult['dates'] }) {
  return (
    <Section id="dates-title" title="Daty">
      {dates.length === 0 ? (
        <Empty />
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th scope="col">Data</th>
              <th scope="col">Dotyczy</th>
            </tr>
          </thead>
          <tbody>
            {dates.map((entry, index) => (
              <tr key={`${String(index)}-${entry.date}`}>
                <td data-label="Data" className="nowrap">
                  <time dateTime={entry.date}>{formatIsoDate(entry.date)}</time>
                </td>
                <td data-label="Dotyczy">{entry.context}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Section>
  );
}

function TagList({ items, label }: { items: readonly string[]; label: string }) {
  if (items.length === 0) return <Empty />;
  return (
    <ul className="tags" aria-label={label}>
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

export function EntitiesSection({ entities }: { entities: AnalysisResult['entities'] }) {
  return (
    <Section id="entities-title" title="Podmioty">
      <h4>Organizacje</h4>
      <TagList items={entities.organizations} label="Organizacje" />
      <h4>Osoby</h4>
      <TagList items={entities.people} label="Osoby" />
    </Section>
  );
}

export function KeywordsSection({ keywords }: { keywords: readonly string[] }) {
  return (
    <Section id="keywords-title" title="Słowa kluczowe">
      <TagList items={keywords} label="Słowa kluczowe" />
    </Section>
  );
}

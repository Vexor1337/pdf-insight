import { useEffect, useRef } from 'react';
import type { AnalysisResult } from '../../shared/schema.ts';
import {
  AmountsSection,
  DatesSection,
  EntitiesSection,
  KeyPointsSection,
  KeywordsSection,
  SummarySection,
} from './result/DataSections.tsx';
import { DocumentCard } from './result/DocumentCard.tsx';
import { JsonPreview } from './result/JsonPreview.tsx';
import { WarningsBanner } from './result/WarningsBanner.tsx';

export function ResultView({ result }: { result: AnalysisResult }) {
  const regionRef = useRef<HTMLElement>(null);
  useEffect(() => {
    regionRef.current?.focus();
  }, [result]);

  return (
    <article className="panel result" ref={regionRef} tabIndex={-1} aria-label="Wynik analizy">
      <DocumentCard document={result.document} />
      <WarningsBanner meta={result.meta} />
      <SummarySection summary={result.summary} />
      <KeyPointsSection keyPoints={result.keyPoints} />
      <div className="grid-2">
        <AmountsSection amounts={result.amounts} />
        <DatesSection dates={result.dates} />
      </div>
      <div className="grid-2">
        <EntitiesSection entities={result.entities} />
        <KeywordsSection keywords={result.keywords} />
      </div>
      <JsonPreview result={result} />
    </article>
  );
}

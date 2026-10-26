import { useEffect, useRef, useState } from 'react';
import { errorMessage, STAGE_LABELS } from '../i18n/pl.ts';
import type { AppError } from '../lib/errors.ts';
import type { Stage } from '../hooks/useAnalysis.ts';

export function EmptyState() {
  return (
    <section className="panel panel--muted" aria-labelledby="empty-title">
      <h2 id="empty-title">Jak to działa?</h2>
      <ol className="steps">
        <li>Wgraj plik PDF (np. umowę, fakturę, ofertę lub raport).</li>
        <li>Aplikacja odczyta tekst, a zeskanowane strony przepisze przez OCR.</li>
        <li>AI przygotuje krótkie podsumowanie i uporządkowane dane.</li>
        <li>Pobierz wynik jako plik JSON.</li>
      </ol>
    </section>
  );
}

const STAGES: readonly Stage[] = ['reading', 'ocr', 'analyzing'];

function useElapsedSeconds(): number {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const started = Date.now();
    const timer = setInterval(() => {
      setSeconds(Math.floor((Date.now() - started) / 1000));
    }, 1000);
    return () => {
      clearInterval(timer);
    };
  }, []);
  return seconds;
}

export function LoadingState({ fileName, stage }: { fileName: string; stage: Stage }) {
  const seconds = useElapsedSeconds();
  const current = STAGES.indexOf(stage);
  return (
    <section className="panel" aria-busy="true" aria-labelledby="loading-title">
      <div className="loading__header">
        <span className="spinner" aria-hidden="true" />
        <h2 id="loading-title">Analizuję „{fileName}”</h2>
      </div>
      <p role="status" aria-live="polite" className="loading__stage">
        {STAGE_LABELS[stage]}
      </p>
      <ol className="progress" aria-label="Etapy analizy">
        {STAGES.map((item, index) => (
          <li
            key={item}
            className={index < current ? 'is-done' : index === current ? 'is-current' : ''}
            aria-current={index === current ? 'step' : undefined}
          >
            {STAGE_LABELS[item].replace('…', '')}
          </li>
        ))}
      </ol>
      <p className="muted">Czas: {seconds} s</p>
    </section>
  );
}

interface ErrorStateProps {
  error: AppError;
  canRetry: boolean;
  onRetry: () => void;
  onReset: () => void;
}

export function ErrorState({ error, canRetry, onRetry, onReset }: ErrorStateProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    headingRef.current?.focus();
  }, [error]);

  return (
    <section className="panel panel--error" role="alert" aria-labelledby="error-title">
      <h2 id="error-title" ref={headingRef} tabIndex={-1}>
        Nie udało się przeanalizować dokumentu
      </h2>
      <p>{errorMessage(error)}</p>
      <div className="actions">
        {canRetry && (
          <button type="button" className="button button--primary" onClick={onRetry}>
            Spróbuj ponownie
          </button>
        )}
        <button type="button" className="button" onClick={onReset}>
          Wybierz inny plik
        </button>
      </div>
    </section>
  );
}

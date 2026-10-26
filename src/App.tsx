import { useCallback, useState } from 'react';
import type { AnalysisResult } from '../shared/schema.ts';
import { Dropzone } from './components/Dropzone.tsx';
import { HistoryPanel } from './components/HistoryPanel.tsx';
import { PrivacyNotice } from './components/PrivacyNotice.tsx';
import { ResultView } from './components/ResultView.tsx';
import { EmptyState, ErrorState, LoadingState } from './components/StatusViews.tsx';
import { useAnalysis } from './hooks/useAnalysis.ts';
import {
  addToHistory,
  clearHistory,
  loadHistory,
  removeFromHistory,
  type HistoryEntry,
} from './lib/history.ts';

const API_URL: string | undefined = import.meta.env.VITE_API_URL;

export function App() {
  const [history, setHistory] = useState<HistoryEntry[]>(loadHistory);
  const onSuccess = useCallback((result: AnalysisResult) => {
    setHistory(addToHistory(result));
  }, []);
  const { state, analyzeFiles, retry, showResult, reset } = useAnalysis({
    apiUrl: API_URL,
    onSuccess,
  });

  return (
    <div className="layout">
      <header className="site-header">
        <h1>PDF Insight</h1>
        <p>
          Wgraj PDF — otrzymasz krótkie podsumowanie i uporządkowane dane do pobrania jako JSON.
        </p>
      </header>

      <main className="main">
        <div className="workspace">
          <Dropzone
            disabled={state.status === 'loading'}
            onFiles={(files) => void analyzeFiles(files)}
          />
          <PrivacyNotice />
          {state.status === 'idle' && <EmptyState />}
          {state.status === 'loading' && (
            <LoadingState fileName={state.fileName} stage={state.stage} />
          )}
          {state.status === 'error' && (
            <ErrorState
              error={state.error}
              canRetry={state.canRetry}
              onRetry={() => void retry()}
              onReset={reset}
            />
          )}
          {state.status === 'success' && <ResultView result={state.result} />}
        </div>
        <HistoryPanel
          entries={history}
          onOpen={(entry) => {
            showResult(entry.result);
          }}
          onRemove={(id) => {
            setHistory(removeFromHistory(id));
          }}
          onClear={() => {
            setHistory(clearHistory());
          }}
        />
      </main>

      <footer className="site-footer">
        <p>
          Wyniki generuje model AI i mogą zawierać błędy — zweryfikuj ważne informacje w dokumencie
          źródłowym.
        </p>
      </footer>
    </div>
  );
}

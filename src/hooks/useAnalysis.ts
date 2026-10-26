import { useCallback, useEffect, useReducer, useRef } from 'react';
import type { AnalyzeRequest } from '../../shared/api.ts';
import type { AnalysisResult } from '../../shared/schema.ts';
import { requestAnalysis } from '../api/analyzeClient.ts';
import { isFileError, toAppError, type AppError } from '../lib/errors.ts';
import type { ExtractionStage } from '../lib/pdf/extractDocument.ts';
import { validatePdfFile } from '../lib/validateFile.ts';

export type Stage = ExtractionStage | 'analyzing';

/** Discriminated union: impossible combinations (e.g. a result while loading) cannot exist. */
export type AnalysisState =
  | { status: 'idle' }
  | { status: 'loading'; fileName: string; stage: Stage }
  | { status: 'success'; result: AnalysisResult }
  | { status: 'error'; error: AppError; canRetry: boolean };

type Action =
  | { type: 'start'; fileName: string }
  | { type: 'stage'; stage: Stage }
  | { type: 'success'; result: AnalysisResult }
  | { type: 'failure'; error: AppError; canRetry: boolean }
  | { type: 'reset' };

function reducer(state: AnalysisState, action: Action): AnalysisState {
  switch (action.type) {
    case 'start':
      return { status: 'loading', fileName: action.fileName, stage: 'reading' };
    case 'stage':
      return state.status === 'loading' ? { ...state, stage: action.stage } : state;
    case 'success':
      return { status: 'success', result: action.result };
    case 'failure':
      return { status: 'error', error: action.error, canRetry: action.canRetry };
    case 'reset':
      return { status: 'idle' };
  }
}

function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

interface Options {
  apiUrl: string | undefined;
  onSuccess: (result: AnalysisResult) => void;
}

export function useAnalysis({ apiUrl, onSuccess }: Options) {
  const [state, dispatch] = useReducer(reducer, { status: 'idle' });
  const controllerRef = useRef<AbortController | null>(null);
  const lastFileRef = useRef<File | null>(null);
  const lastPayloadRef = useRef<AnalyzeRequest | null>(null);

  useEffect(() => () => controllerRef.current?.abort(), []);

  const extract = useCallback(async (file: File, signal: AbortSignal) => {
    const { extractDocument } = await import('../lib/pdf/extractDocument.ts');
    return extractDocument(file, {
      signal,
      onStage: (stage) => {
        dispatch({ type: 'stage', stage });
      },
    });
  }, []);

  const run = useCallback(
    async (file: File, cachedPayload: AnalyzeRequest | null) => {
      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;
      const { signal } = controller;
      dispatch({ type: 'start', fileName: file.name });

      try {
        const payload = cachedPayload ?? (await extract(file, signal));
        lastPayloadRef.current = payload;
        dispatch({ type: 'stage', stage: 'analyzing' });
        const result = await requestAnalysis(payload, { apiUrl, signal });
        if (signal.aborted) return;
        dispatch({ type: 'success', result });
        onSuccess(result);
      } catch (error) {
        if (signal.aborted || isAbort(error)) return;
        const appError = toAppError(error);
        dispatch({ type: 'failure', error: appError, canRetry: !isFileError(appError) });
      }
    },
    [apiUrl, extract, onSuccess],
  );

  const analyzeFiles = useCallback(
    async (files: readonly File[]) => {
      controllerRef.current?.abort();
      try {
        const file = await validatePdfFile(files);
        lastFileRef.current = file;
        lastPayloadRef.current = null;
        await run(file, null);
      } catch (error) {
        dispatch({ type: 'failure', error: toAppError(error), canRetry: false });
      }
    },
    [run],
  );

  const retry = useCallback(async () => {
    const file = lastFileRef.current;
    if (file) await run(file, lastPayloadRef.current);
  }, [run]);

  const showResult = useCallback((result: AnalysisResult) => {
    controllerRef.current?.abort();
    dispatch({ type: 'success', result });
  }, []);

  const reset = useCallback(() => {
    controllerRef.current?.abort();
    dispatch({ type: 'reset' });
  }, []);

  return { state, analyzeFiles, retry, showResult, reset };
}

import { z } from 'zod';
import { HISTORY_LIMIT } from '../../shared/limits.ts';
import { AnalysisResultSchema, type AnalysisResult } from '../../shared/schema.ts';

const STORAGE_KEY = 'pdf-insight:history:v1';

export interface HistoryEntry {
  id: string;
  savedAt: string;
  result: AnalysisResult;
}

const EntrySchema = z.object({
  id: z.string().min(1).max(64),
  savedAt: z.iso.datetime(),
  result: AnalysisResultSchema,
});

function getStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function parseEntries(raw: string | null): HistoryEntry[] {
  if (!raw) return [];
  try {
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data.flatMap((item) => {
      const parsed = EntrySchema.safeParse(item);
      return parsed.success ? [parsed.data] : [];
    });
  } catch {
    return [];
  }
}

function writeEntries(entries: HistoryEntry[]): void {
  try {
    getStorage()?.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {}
}

export function loadHistory(): HistoryEntry[] {
  try {
    return parseEntries(getStorage()?.getItem(STORAGE_KEY) ?? null).slice(0, HISTORY_LIMIT);
  } catch {
    return [];
  }
}

export function addToHistory(result: AnalysisResult, now: Date = new Date()): HistoryEntry[] {
  const entry: HistoryEntry = { id: crypto.randomUUID(), savedAt: now.toISOString(), result };
  const entries = [entry, ...loadHistory()].slice(0, HISTORY_LIMIT);
  writeEntries(entries);
  return entries;
}

export function removeFromHistory(id: string): HistoryEntry[] {
  const entries = loadHistory().filter((entry) => entry.id !== id);
  writeEntries(entries);
  return entries;
}

export function clearHistory(): HistoryEntry[] {
  try {
    getStorage()?.removeItem(STORAGE_KEY);
  } catch {}
  return [];
}

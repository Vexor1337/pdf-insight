import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HISTORY_LIMIT } from '../../shared/limits.ts';
import {
  addToHistory,
  clearHistory,
  loadHistory,
  removeFromHistory,
} from '../../src/lib/history.ts';
import { validResult } from './helpers/validResult.ts';

class MemoryStorage {
  private readonly data = new Map<string, string>();
  getItem(key: string) {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.data.set(key, value);
  }
  removeItem(key: string) {
    this.data.delete(key);
  }
}

const KEY = 'pdf-insight:history:v1';

describe('history', () => {
  let storage: MemoryStorage;

  beforeEach(() => {
    storage = new MemoryStorage();
    vi.stubGlobal('window', { localStorage: storage });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('stores newest results first and caps the list', () => {
    for (let index = 0; index < HISTORY_LIMIT + 3; index += 1) {
      const result = validResult();
      result.document.fileName = `plik-${String(index)}.pdf`;
      addToHistory(result);
    }
    const entries = loadHistory();
    expect(entries).toHaveLength(HISTORY_LIMIT);
    expect(entries[0]?.result.document.fileName).toBe(`plik-${String(HISTORY_LIMIT + 2)}.pdf`);
  });

  it('removes a single entry and clears all entries', () => {
    const [first] = addToHistory(validResult());
    addToHistory(validResult());
    expect(removeFromHistory(first?.id ?? '')).toHaveLength(1);
    expect(clearHistory()).toEqual([]);
    expect(loadHistory()).toEqual([]);
  });

  it('skips entries that do not match the schema', () => {
    addToHistory(validResult());
    const stored = JSON.parse(storage.getItem(KEY) ?? '[]') as unknown[];
    storage.setItem(
      KEY,
      JSON.stringify([...stored, { id: 'x', savedAt: 'zła data', result: {} }, 42]),
    );
    expect(loadHistory()).toHaveLength(1);
  });

  it('returns an empty list for corrupted JSON', () => {
    storage.setItem(KEY, '{not json');
    expect(loadHistory()).toEqual([]);
  });

  it('does not throw when storage is blocked', () => {
    vi.stubGlobal('window', {
      get localStorage(): Storage {
        throw new Error('SecurityError');
      },
    });
    expect(loadHistory()).toEqual([]);
    expect(() => addToHistory(validResult())).not.toThrow();
  });
});

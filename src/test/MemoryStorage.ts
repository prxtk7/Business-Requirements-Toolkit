/** Minimal in-memory `Storage` implementation with optional write failure for tests. */
export class MemoryStorage implements Storage {
  private data = new Map<string, string>();
  failWrites: false | 'quota' | 'generic' = false;

  get length(): number {
    return this.data.size;
  }

  clear(): void {
    this.data.clear();
  }

  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }

  key(index: number): string | null {
    return [...this.data.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.data.delete(key);
  }

  setItem(key: string, value: string): void {
    if (this.failWrites === 'quota') throw new DOMException('Quota exceeded', 'QuotaExceededError');
    if (this.failWrites === 'generic') throw new Error('Write failed');
    this.data.set(key, String(value));
  }

  keys(): string[] {
    return [...this.data.keys()];
  }
}

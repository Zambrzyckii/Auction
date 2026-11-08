import { TokenStorage } from './token-storage';

class MemoryStorage {
  private store = new Map<string, string>();

  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }
}

describe('TokenStorage', () => {
  beforeEach(() => {
    // jsdom under the unit-test builder exposes no Web Storage (opaque origin)
    Object.defineProperty(window, 'localStorage', { value: new MemoryStorage(), configurable: true });
    Object.defineProperty(window, 'sessionStorage', { value: new MemoryStorage(), configurable: true });
  });

  it('returns null when nothing is stored', () => {
    expect(new TokenStorage().get()).toBeNull();
  });

  it('returns the stored token', () => {
    const storage = new TokenStorage();
    storage.set('abc.def.ghi');
    expect(storage.get()).toBe('abc.def.ghi');
  });

  it('clear removes the token', () => {
    const storage = new TokenStorage();
    storage.set('abc');
    storage.clear();
    expect(storage.get()).toBeNull();
  });

  it('a fresh instance sees what another one stored', () => {
    new TokenStorage().set('abc');
    expect(new TokenStorage().get()).toBe('abc');
  });
});

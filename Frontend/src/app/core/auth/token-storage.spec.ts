import { installStorageStub } from '../../../testing/storage-stub';
import { TokenStorage } from './token-storage';

describe('TokenStorage', () => {
  beforeEach(() => {
    installStorageStub();
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

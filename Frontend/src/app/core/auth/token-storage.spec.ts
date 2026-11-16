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

  it('keeps the refresh token under its own key', () => {
    const storage = new TokenStorage();
    storage.set('abc');
    storage.setRefresh('r1');
    expect(storage.getRefresh()).toBe('r1');
    expect(storage.get()).toBe('abc');
    expect(window.localStorage.getItem('auction.refresh')).toBe('r1');
  });

  it('setRefresh with null or undefined removes the key and never stores "undefined"', () => {
    const storage = new TokenStorage();
    storage.setRefresh('r1');
    storage.setRefresh(undefined);
    expect(storage.getRefresh()).toBeNull();
    storage.setRefresh('r2');
    storage.setRefresh(null);
    expect(storage.getRefresh()).toBeNull();
    expect(window.localStorage.getItem('auction.refresh')).toBeNull();
  });

  it('clear removes both keys', () => {
    const storage = new TokenStorage();
    storage.set('abc');
    storage.setRefresh('r1');
    storage.clear();
    expect(storage.get()).toBeNull();
    expect(storage.getRefresh()).toBeNull();
  });
});

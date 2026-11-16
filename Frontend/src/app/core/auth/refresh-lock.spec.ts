import { REFRESH_LOCK, withRefreshLock } from './refresh-lock';

describe('withRefreshLock', () => {
  afterEach(() => {
    Reflect.deleteProperty(navigator, 'locks');
  });

  it('runs the task directly when navigator.locks is missing', async () => {
    expect(navigator.locks).toBeUndefined();

    await expect(withRefreshLock(() => Promise.resolve(42))).resolves.toBe(42);
  });

  it('runs the task inside the auction.refresh lock when navigator.locks exists', async () => {
    const request = vi.fn((name: string, callback: (lock: Lock) => Promise<unknown>) =>
      callback({ name, mode: 'exclusive' }),
    );
    Object.defineProperty(navigator, 'locks', { value: { request }, configurable: true });

    const result = await withRefreshLock(() => Promise.resolve('ok'));

    expect(result).toBe('ok');
    expect(REFRESH_LOCK).toBe('auction.refresh');
    expect(request).toHaveBeenCalledWith(REFRESH_LOCK, expect.any(Function));
  });
});

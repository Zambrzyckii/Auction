export const REFRESH_LOCK = 'auction.refresh';

export function withRefreshLock<T>(task: () => Promise<T>): Promise<T> {
  const locks = globalThis.navigator?.locks;
  return locks === undefined ? task() : locks.request(REFRESH_LOCK, () => task());
}

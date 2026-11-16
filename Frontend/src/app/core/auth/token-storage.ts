import { Injectable } from '@angular/core';

export const TOKEN_KEY = 'auction.token';
export const REFRESH_KEY = 'auction.refresh';

@Injectable({ providedIn: 'root' })
export class TokenStorage {
  get(): string | null {
    return window.localStorage.getItem(TOKEN_KEY);
  }

  set(token: string): void {
    window.localStorage.setItem(TOKEN_KEY, token);
  }

  getRefresh(): string | null {
    return window.localStorage.getItem(REFRESH_KEY);
  }

  setRefresh(value: string | null | undefined): void {
    if (value) {
      window.localStorage.setItem(REFRESH_KEY, value);
    } else {
      window.localStorage.removeItem(REFRESH_KEY);
    }
  }

  clear(): void {
    window.localStorage.removeItem(TOKEN_KEY);
    window.localStorage.removeItem(REFRESH_KEY);
  }
}

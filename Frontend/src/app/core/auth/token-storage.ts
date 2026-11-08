import { Injectable } from '@angular/core';

const TOKEN_KEY = 'auction.token';

@Injectable({ providedIn: 'root' })
export class TokenStorage {
  get(): string | null {
    return window.localStorage.getItem(TOKEN_KEY);
  }

  set(token: string): void {
    window.localStorage.setItem(TOKEN_KEY, token);
  }

  clear(): void {
    window.localStorage.removeItem(TOKEN_KEY);
  }
}

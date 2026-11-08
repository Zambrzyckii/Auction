import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, map, tap } from 'rxjs';
import { LoginResponse } from '../api/models';
import { decodeJwtClaims } from './jwt';
import { TokenStorage } from './token-storage';

export interface RegisterData {
  readonly email: string;
  readonly password: string;
  readonly username: string;
  readonly name: string;
  readonly surname: string;
  readonly birthday: string;
}

@Injectable({ providedIn: 'root' })
export class Session {
  private readonly http = inject(HttpClient);
  private readonly storage = inject(TokenStorage);

  private readonly tokenSignal = signal<string | null>(this.storage.get());

  readonly token = this.tokenSignal.asReadonly();
  readonly claims = computed(() => {
    const token = this.tokenSignal();
    return token === null ? null : decodeJwtClaims(token);
  });
  readonly userId = computed(() => this.claims()?.nameid ?? null);
  readonly email = computed(() => this.claims()?.unique_name ?? null);
  readonly isLoggedIn = computed(() => this.userId() !== null);

  login(email: string, password: string): Observable<void> {
    return this.http.post<LoginResponse>('/api/users/login', { email, password }).pipe(
      tap((response) => {
        this.storage.set(response.token);
        this.tokenSignal.set(response.token);
      }),
      map(() => undefined),
    );
  }

  register(data: RegisterData): Observable<void> {
    return this.http.post('/api/users/register', data).pipe(map(() => undefined));
  }

  logout(): void {
    this.storage.clear();
    this.tokenSignal.set(null);
  }

  // the 401 interceptor clears the storage without touching this service
  syncFromStorage(): void {
    this.tokenSignal.set(this.storage.get());
  }
}

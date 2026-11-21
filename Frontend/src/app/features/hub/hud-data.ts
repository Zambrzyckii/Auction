import { HttpClient } from '@angular/common/http';
import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { Subscription } from 'rxjs';
import { OwnProfile, Wallet } from '../../core/api/models';
import { Session } from '../../core/auth/session';
import { PushClient } from '../../core/push/push-client';

const POLL_MS = 5000;

@Injectable({ providedIn: 'root' })
export class HudData {
  private readonly http = inject(HttpClient);
  private readonly session = inject(Session);
  private readonly push = inject(PushClient);

  private readonly walletSignal = signal<Wallet | null>(null);
  private readonly profile = signal<OwnProfile | null>(null);

  readonly wallet = this.walletSignal.asReadonly();
  readonly username = computed(() => this.profile()?.username ?? null);
  readonly level = computed(() => this.profile()?.level ?? null);

  constructor() {
    effect((onCleanup) => {
      const userId = this.session.userId();
      if (userId === null) {
        return;
      }
      untracked(() => this.run(userId, onCleanup));
    });
  }

  private run(userId: string, onCleanup: (fn: () => void) => void): void {
    let walletSub: Subscription | undefined;
    let profileSub: Subscription | undefined;

    const loadWallet = (): void => {
      walletSub?.unsubscribe();
      walletSub = this.http.get<Wallet>(`/api/wallets/${userId}`).subscribe({
        next: (wallet) => this.walletSignal.set(wallet),
        error: () => undefined,
      });
    };

    const loadProfile = (): void => {
      profileSub?.unsubscribe();
      profileSub = this.http.get<OwnProfile>('/api/profiles/me').subscribe({
        next: (profile) => this.profile.set(profile),
        error: () => undefined,
      });
    };

    const loadAll = (): void => {
      loadWallet();
      loadProfile();
    };

    loadAll();
    const timer = setInterval(loadAll, POLL_MS);
    const off = this.push.on('WalletChanged', loadWallet);

    onCleanup(() => {
      clearInterval(timer);
      off();
      walletSub?.unsubscribe();
      profileSub?.unsubscribe();
      this.walletSignal.set(null);
      this.profile.set(null);
    });
  }
}

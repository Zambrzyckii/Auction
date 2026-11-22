import { Component, computed, DestroyRef, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Session } from '../../core/auth/session';
import { PushClient } from '../../core/push/push-client';
import { HubPage } from '../../pixel/hub/hub-page';
import type { BuildingId } from '../../pixel/street/city';
import type { HudState } from '../../pixel/street/hud';
import { BUILDING_LINKS, BUILDING_PATHS } from '../welcome/welcome-rules';
import { playerXp } from './hub-rules';
import { HudData } from './hud-data';
import { buildFx, HubFx, METER_TOPICS, MeterReading, newestTopic } from './meter-rules';

function sameHud(a: HudState | null, b: HudState | null): boolean {
  if (a === null || b === null) return a === b;
  return (
    a.name === b.name &&
    a.cash === b.cash &&
    a.level === b.level &&
    a.share === b.share &&
    a.nextAt === b.nextAt
  );
}

@Component({
  selector: 'app-hub',
  imports: [HubPage],
  templateUrl: './hub.html',
})
export class Hub {
  private readonly router = inject(Router);
  private readonly session = inject(Session);
  private readonly data = inject(HudData);
  private readonly push = inject(PushClient);

  readonly links = BUILDING_LINKS;
  readonly paths = BUILDING_PATHS;

  readonly email = computed(() => this.session.email() ?? '');

  readonly hud = computed<HudState | null>(
    () => {
      const wallet = this.data.wallet();
      const name = this.data.username();
      const level = this.data.level();
      if (wallet === null || name === null || level === null) return null;
      const { share, nextAt } = playerXp(level, wallet.lifetimeTurnover);
      return { name, cash: wallet.availableFunds, level, share, nextAt };
    },
    { equal: sameHud },
  );

  private readonly total = computed(() => {
    const wallet = this.data.wallet();
    return wallet === null ? null : wallet.availableFunds + wallet.lockedFunds;
  });

  readonly fx = signal<HubFx | null>(null);

  private readonly seen = new Map<string, number>();
  private previous: MeterReading | null = null;

  constructor() {
    const offs = METER_TOPICS.map((topic) =>
      this.push.on(topic, () => this.seen.set(topic, Date.now())),
    );
    inject(DestroyRef).onDestroy(() => offs.forEach((off) => off()));

    effect(() => {
      const hud = this.hud();
      const total = this.total();
      if (hud === null || total === null) return;
      const next = { hud, total };
      const prev = this.previous;
      this.previous = next;
      if (prev === null) return;
      const fx = buildFx(prev, next, newestTopic(this.seen, Date.now()));
      if (fx !== null) this.fx.set(fx);
    });
  }

  open(id: BuildingId): void {
    void this.router.navigateByUrl(BUILDING_PATHS[id]);
  }

  logout(): void {
    this.session.logout();
    void this.router.navigateByUrl('/welcome');
  }
}

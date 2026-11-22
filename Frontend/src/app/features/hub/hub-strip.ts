import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { Session } from '../../core/auth/session';
import { NavStrip } from '../../pixel/hub/nav-strip';
import { stripWhere } from './hub-rules';
import { HudData } from './hud-data';

@Component({
  selector: 'app-hub-strip',
  imports: [NavStrip],
  template: `
    @if (where(); as door) {
      <app-nav-strip
        [where]="door"
        [cash]="data.wallet()?.availableFunds ?? null"
        [level]="data.level()"
        (loggedOut)="logout()"
      />
    }
  `,
})
export class HubStrip {
  private readonly router = inject(Router);
  private readonly session = inject(Session);
  protected readonly data = inject(HudData);

  private readonly url = signal(this.router.url);

  protected readonly where = computed(() =>
    this.session.isLoggedIn() ? stripWhere(this.url()) : null,
  );

  constructor() {
    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe((event) => this.url.set(event.urlAfterRedirects));
  }

  protected logout(): void {
    this.session.logout();
    void this.router.navigateByUrl('/welcome');
  }
}

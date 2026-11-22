import { Component, effect, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Session } from './core/auth/session';
import { SessionRefresher } from './core/auth/session-refresher';
import { PushClient } from './core/push/push-client';
import { HubStrip } from './features/hub/hub-strip';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, HubStrip],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected readonly session = inject(Session);
  private readonly router = inject(Router);
  private readonly push = inject(PushClient);

  constructor() {
    inject(SessionRefresher);
    effect(() => {
      const token = this.session.token();
      if (token === null) {
        this.push.disconnect();
      } else {
        this.push.connect();
      }
    });
  }

  protected logout(): void {
    this.session.logout();
    this.router.navigateByUrl('/auctions');
  }
}

import { Component, effect, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Session } from './core/auth/session';
import { PushClient } from './core/push/push-client';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected readonly session = inject(Session);
  private readonly router = inject(Router);
  private readonly push = inject(PushClient);

  constructor() {
    effect(() => {
      const token = this.session.token();
      if (token === null) {
        this.push.disconnect();
      } else {
        this.push.connect(token);
      }
    });
  }

  protected logout(): void {
    this.session.logout();
    this.router.navigateByUrl('/auctions');
  }
}

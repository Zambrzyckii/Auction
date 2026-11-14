import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormField, email, form, required, submit } from '@angular/forms/signals';
import { firstValueFrom } from 'rxjs';
import { toApiError } from '../../core/api/api-error';
import { Session } from '../../core/auth/session';

export function sanitizeReturnUrl(raw: string | null): string {
  if (raw === null || !raw.startsWith('/') || raw[1] === '/') {
    return '/auctions';
  }
  for (const ch of raw) {
    if (ch === '\\' || ch < ' ') {
      return '/auctions';
    }
  }
  return raw;
}

@Component({
  selector: 'app-login',
  imports: [FormField, RouterLink],
  templateUrl: './login.html',
})
export class Login {
  private readonly session = inject(Session);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly error = signal<string | null>(null);
  protected readonly pending = signal(false);

  private readonly model = signal({ email: '', password: '' });
  protected readonly loginForm = form(this.model, (path) => {
    required(path.email);
    email(path.email);
    required(path.password);
  });

  constructor() {
    this.session.syncFromStorage();
  }

  protected async submitForm(): Promise<void> {
    await submit(this.loginForm, async () => {
      this.error.set(null);
      this.pending.set(true);
      try {
        const { email: userEmail, password } = this.model();
        await firstValueFrom(this.session.login(userEmail, password));
        const returnUrl = sanitizeReturnUrl(this.route.snapshot.queryParamMap.get('returnUrl'));
        await this.router.navigateByUrl(returnUrl);
      } catch (err) {
        const apiError = toApiError(err);
        this.error.set(
          apiError.status === 400 || apiError.status === 401
            ? 'Invalid credentials.'
            : apiError.message,
        );
      } finally {
        this.pending.set(false);
      }
    });
  }
}

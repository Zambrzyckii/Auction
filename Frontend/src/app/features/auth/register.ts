import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  FormField,
  email,
  form,
  maxDateError,
  maxLength,
  patternError,
  required,
  submit,
  validate,
} from '@angular/forms/signals';
import { firstValueFrom } from 'rxjs';
import { toApiError } from '../../core/api/api-error';
import { RegisterData, Session } from '../../core/auth/session';

// mirrored from the backend RegisterCommandValidator
const PASSWORD_REQUIREMENTS = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\da-zA-Z]).{8,}$/;

export function isPasswordStrong(password: string): boolean {
  return PASSWORD_REQUIREMENTS.test(password);
}

export function isBirthdayBeforeToday(birthday: string): boolean {
  return birthday < new Date().toISOString().slice(0, 10);
}

@Component({
  selector: 'app-register',
  imports: [FormField, RouterLink],
  templateUrl: './register.html',
})
export class Register {
  private readonly session = inject(Session);
  private readonly router = inject(Router);

  protected readonly error = signal<string | null>(null);
  protected readonly pending = signal(false);

  private readonly model = signal<RegisterData>({
    email: '',
    password: '',
    username: '',
    name: '',
    surname: '',
    birthday: '',
  });

  protected readonly registerForm = form(this.model, (path) => {
    required(path.email);
    email(path.email);
    required(path.username);
    maxLength(path.username, 30);
    required(path.name);
    maxLength(path.name, 30);
    required(path.surname);
    maxLength(path.surname, 30);
    required(path.password);
    validate(path.password, ({ value }) =>
      value() === '' || isPasswordStrong(value()) ? undefined : patternError(PASSWORD_REQUIREMENTS),
    );
    required(path.birthday);
    validate(path.birthday, ({ value }) =>
      value() === '' || isBirthdayBeforeToday(value()) ? undefined : maxDateError(new Date()),
    );
  });

  protected async submitForm(): Promise<void> {
    await submit(this.registerForm, async () => {
      this.error.set(null);
      this.pending.set(true);
      try {
        await firstValueFrom(this.session.register(this.model()));
        await firstValueFrom(this.session.login(this.model().email, this.model().password));
        await this.router.navigateByUrl('/wallet');
      } catch (err) {
        const apiError = toApiError(err);
        this.error.set(apiError.status === 409 ? 'This email is already taken.' : apiError.message);
      } finally {
        this.pending.set(false);
      }
    });
  }
}

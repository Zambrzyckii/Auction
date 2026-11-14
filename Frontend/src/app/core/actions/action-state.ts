import { Signal, WritableSignal, signal } from '@angular/core';
import { Observable } from 'rxjs';
import { toApiError } from '../api/api-error';

export interface ActionState {
  readonly pending: Signal<boolean>;
  readonly notice: WritableSignal<string | null>;
  run<T>(request: Observable<T>, onSuccess?: (result: T) => void, onError?: () => void): void;
}

export function actionState(): ActionState {
  const pending = signal(false);
  const notice = signal<string | null>(null);

  function run<T>(
    request: Observable<T>,
    onSuccess?: (result: T) => void,
    onError?: () => void,
  ): void {
    if (pending()) {
      return;
    }
    pending.set(true);
    notice.set(null);
    request.subscribe({
      next: (result) => {
        pending.set(false);
        onSuccess?.(result);
      },
      error: (err: unknown) => {
        notice.set(toApiError(err).message);
        pending.set(false);
        onError?.();
      },
    });
  }

  return { pending: pending.asReadonly(), notice, run };
}

import { DestroyRef, Signal, inject, signal } from '@angular/core';

export function clock(periodMs = 1000): Signal<number> {
  const now = signal(Date.now());
  const timer = setInterval(() => now.set(Date.now()), periodMs);
  inject(DestroyRef).onDestroy(() => clearInterval(timer));
  return now.asReadonly();
}

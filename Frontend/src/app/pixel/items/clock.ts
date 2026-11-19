import { signal, Signal, WritableSignal } from '@angular/core';

export interface ClockHandle {
  readonly now: Signal<number>;
  release(): void;
}

let now: WritableSignal<number> | undefined;
let timer: ReturnType<typeof setInterval> | undefined;
let holders = 0;

export function acquireClock(): ClockHandle {
  now ??= signal(Date.now());
  if (holders === 0) {
    now.set(Date.now());
    timer = setInterval(() => now?.set(Date.now()), 1000);
  }
  holders++;
  let released = false;
  return {
    now,
    release() {
      if (released) return;
      released = true;
      holders--;
      if (holders === 0) {
        clearInterval(timer);
        timer = undefined;
      }
    },
  };
}

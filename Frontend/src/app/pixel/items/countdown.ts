import { Component, DestroyRef, inject, input } from '@angular/core';
import { acquireClock } from './clock';

@Component({
  selector: 'app-countdown',
  template: '{{ format()(endsOn(), now()) }}',
  styles: [':host { display: inline; font-variant-numeric: tabular-nums; }'],
})
export class Countdown {
  readonly endsOn = input.required<string>();
  readonly format = input.required<(endsOn: string, now: number) => string>();

  private readonly clock = acquireClock();
  protected readonly now = this.clock.now;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.clock.release());
  }
}

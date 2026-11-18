import { Directive, computed, input, signal } from '@angular/core';

@Directive({
  selector: 'button[appRevealPassword]',
  exportAs: 'revealPassword',
  host: {
    '[attr.aria-label]': 'ariaLabel()',
    '(click)': 'toggle()',
  },
})
export class RevealPassword {
  readonly appRevealPassword = input.required<HTMLInputElement>();

  readonly shown = signal(false);
  readonly label = computed(() => (this.shown() ? 'Hide' : 'Show'));
  protected readonly ariaLabel = computed(() => (this.shown() ? 'Hide password' : 'Show password'));

  toggle(): void {
    this.shown.update((shown) => !shown);
    this.appRevealPassword().type = this.shown() ? 'text' : 'password';
  }
}

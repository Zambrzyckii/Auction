import { DestroyRef, Directive, ElementRef, inject, signal } from '@angular/core';

@Directive({
  selector: '[appHeightProbe]',
  exportAs: 'heightProbe',
})
export class HeightProbe {
  readonly height = signal(0);

  constructor() {
    if (typeof ResizeObserver === 'undefined') {
      return;
    }
    const host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const observer = new ResizeObserver(() =>
      this.height.set(Math.ceil(host.getBoundingClientRect().height)),
    );
    observer.observe(host);
    inject(DestroyRef).onDestroy(() => observer.disconnect());
  }
}

import { Directive, ElementRef, inject } from '@angular/core';

@Directive({
  selector: '[appDropOnce]',
  host: { '(animationend)': 'settle($event)' },
})
export class DropOnce {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected settle(event: AnimationEvent): void {
    if (event.animationName !== 'x-drop') return;
    this.host.nativeElement.classList.add('dropped');
  }
}

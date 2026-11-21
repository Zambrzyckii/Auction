import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { DropOnce } from './drop-once';

@Component({ template: '<li appDropOnce></li>', imports: [DropOnce] })
class Host {}

function end(name: string): Event {
  const event = new Event('animationend', { bubbles: true }) as Event & { animationName?: string };
  event.animationName = name;
  return event;
}

describe('DropOnce', () => {
  it('marks the element dropped only after the entrance animation', async () => {
    await TestBed.configureTestingModule({ imports: [Host] }).compileComponents();
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const li = (fixture.nativeElement as HTMLElement).querySelector('li')!;

    li.dispatchEvent(end('x-hop'));
    expect(li.classList.contains('dropped')).toBe(false);

    li.dispatchEvent(end('x-drop'));
    expect(li.classList.contains('dropped')).toBe(true);
  });
});

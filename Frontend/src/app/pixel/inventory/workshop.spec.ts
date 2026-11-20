import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import type { ShelfItem } from './shelf-item';
import { Workshop, workshopDeps } from './workshop';

@Component({
  imports: [Workshop],
  template: `<app-workshop
    [items]="items()"
    [picked]="picked()"
    [pending]="pending()"
    [ready]="ready()"
    (takeOff)="off.push($event)"
    ><p>Selected <button type="button" class="craft">Craft</button></p></app-workshop
  >`,
})
class Host {
  readonly items = signal<readonly ShelfItem[]>([]);
  readonly picked = signal<readonly string[]>([]);
  readonly pending = signal(false);
  readonly ready = signal(false);
  readonly off: string[] = [];
}

const c = (id: string): ShelfItem => ({
  publicItemId: id,
  name: 'Old Radio',
  rarity: 'Common',
  status: 'Available',
  officialPrice: 10,
});
const shelf = [c('a'), c('b'), c('c'), c('d')];
const crafted: ShelfItem = {
  publicItemId: 'n',
  name: 'Crafted Rare Item',
  rarity: 'Rare',
  status: 'Available',
  officialPrice: 1234,
};

describe('Workshop', () => {
  let fixture: ComponentFixture<Host>;
  let host: Host;
  let el: HTMLElement;
  let ws: Workshop;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [Host] }).compileComponents();
    fixture = TestBed.createComponent(Host);
    host = fixture.componentInstance;
    el = fixture.nativeElement;
    fixture.detectChanges();
    ws = fixture.debugElement.query(By.directive(Workshop)).componentInstance;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const set = (apply: () => void): void => {
    apply();
    fixture.detectChanges();
  };
  const why = (): string => el.querySelector('p.why')!.textContent!.replace(/\s+/g, ' ').trim();
  const q = (selector: string): HTMLElement | null => el.querySelector(selector);

  const pressAndCraft = (): void => {
    set(() => {
      host.items.set(shelf);
      host.picked.set(['a', 'b', 'c']);
    });
    set(() => host.pending.set(true));
  };

  it('starts closed with the craft button projected', () => {
    expect(q('button.door')!.getAttribute('aria-expanded')).toBe('false');
    expect(q('.room')!.hasAttribute('hidden')).toBe(true);
    expect(q('app-workshop button.craft')).not.toBeNull();
    expect(q('.door-pull')!.textContent).toBe('Roll the door up');
  });

  it('opens and closes the door at once without Element.animate', () => {
    q('button.door')!.click();
    fixture.detectChanges();
    expect(q('button.door')!.getAttribute('aria-expanded')).toBe('true');
    expect(q('.room')!.hasAttribute('hidden')).toBe(false);
    expect(q('.door-pull')!.textContent).toBe('Roll the door down');
    expect(ws.open()).toBe(true);
    q('button.door')!.click();
    fixture.detectChanges();
    expect(q('button.door')!.getAttribute('aria-expanded')).toBe('false');
  });

  it('keeps the pick order and the first three on the belt', () => {
    set(() => {
      host.items.set(shelf);
      host.picked.set(['d', 'a', 'b', 'c']);
    });
    expect(ws.belt().map((i) => i.publicItemId)).toEqual(['d', 'a', 'b']);
  });

  it('renders a slot button per belt item that takes it off', () => {
    set(() => {
      host.items.set(shelf);
      host.picked.set(['a', 'b']);
    });
    const slots = el.querySelectorAll<HTMLButtonElement>('button.slot');
    expect(slots.length).toBe(2);
    expect(slots[0].getAttribute('aria-label')).toBe('Take Old Radio off the belt');
    slots[0].click();
    expect(host.off).toEqual(['a']);
  });

  it('renders no slot buttons while pending', () => {
    set(() => {
      host.items.set(shelf);
      host.picked.set(['a', 'b', 'c']);
    });
    set(() => host.pending.set(true));
    expect(el.querySelectorAll('button.slot').length).toBe(0);
  });

  it('explains why the press cannot run', () => {
    expect(why()).toBe('Pick three items of one rarity from the shelf below.');

    set(() => {
      host.items.set([{ ...c('a'), status: 'LockedForAuction' }, c('b')]);
      host.picked.set(['a']);
    });
    expect(why()).toBe('Locked items stay off the belt.');

    set(() => {
      host.items.set([{ ...c('a'), rarity: 'Legendary' }, c('b')]);
      host.picked.set(['a']);
    });
    expect(why()).toBe('Legendary is the top, it cannot go in.');

    set(() => {
      host.items.set([{ ...c('a'), rarity: 'Rare' }, c('b')]);
      host.picked.set(['a', 'b']);
    });
    expect(why()).toBe('Mixed rarities. The press takes one rarity at a time.');

    set(() => {
      host.items.set(shelf);
      host.picked.set(['a', 'b', 'c', 'd']);
    });
    expect(why()).toBe('4 picked, the belt takes three. Take one off.');

    set(() => host.picked.set(['a']));
    expect(why()).toBe('2 more Common items to go.');

    set(() => host.picked.set(['a', 'b']));
    expect(why()).toBe('1 more Common item to go.');

    set(() => host.picked.set(['a', 'b', 'c']));
    expect(why()).toBe('Ready. Three Common in, one Rare out.');
  });

  it('reveals at once when no scene ran', () => {
    pressAndCraft();
    expect(why()).toBe('Pressing…');
    set(() => {
      host.pending.set(false);
      host.picked.set([]);
    });
    expect(ws.hidden()).toContain('a');
    expect(ws.fresh()).toBeNull();
    expect(why()).toBe('You made a Crafted Rare Item. Appraising…');
    set(() => host.items.set([c('d'), crafted]));
    expect(ws.hidden()).not.toContain('n');
    expect(ws.fresh()).toBe('n');
    expect(why()).toBe('You made a Crafted Rare Item. Official price 1,234.');
  });

  it('keeps a card that lands during the press hidden', () => {
    pressAndCraft();
    set(() => host.items.set([c('d'), crafted]));
    expect(ws.hidden()).toContain('n');
    expect(why()).toBe('Pressing…');
    set(() => {
      host.pending.set(false);
      host.picked.set([]);
    });
    expect(ws.fresh()).toBe('n');
    expect(ws.hidden()).not.toContain('n');
  });

  it('hides nothing after a failed craft', () => {
    pressAndCraft();
    set(() => host.items.set([...shelf, { ...crafted, publicItemId: 'w' }]));
    expect(ws.hidden()).toContain('w');
    set(() => host.pending.set(false));
    expect(ws.hidden()).toEqual([]);
    expect(ws.fresh()).toBeNull();
    expect(why()).toBe('Ready. Three Common in, one Rare out.');
  });

  it('clears the result on the next pick', () => {
    pressAndCraft();
    set(() => {
      host.pending.set(false);
      host.picked.set([]);
    });
    set(() => host.items.set([c('d'), crafted]));
    expect(ws.fresh()).toBe('n');
    set(() => host.picked.set(['d']));
    expect(ws.fresh()).toBeNull();
    expect(why()).toBe('2 more Common items to go.');
  });

  it('keeps the spent cards hidden after a pick until the poll drops them', () => {
    pressAndCraft();
    set(() => {
      host.pending.set(false);
      host.picked.set([]);
    });
    set(() => host.picked.set(['d']));
    expect(ws.hidden()).toEqual(expect.arrayContaining(['a', 'b', 'c']));
    expect(ws.fresh()).toBeNull();
    set(() => host.items.set([c('d'), crafted]));
    expect(ws.hidden()).not.toContain('a');
    expect(ws.hidden()).not.toContain('b');
    expect(ws.hidden()).not.toContain('c');
  });

  it('renders no notice or error', () => {
    pressAndCraft();
    set(() => {
      host.pending.set(false);
      host.picked.set([]);
    });
    expect(q('.notice')).toBeNull();
    expect(q('.error')).toBeNull();
  });

  it('workshopDeps refuses to run without ResizeObserver', () => {
    vi.stubGlobal('ResizeObserver', undefined);
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
    vi.stubGlobal('IntersectionObserver', class {});
    expect(workshopDeps().canRun(document.createElement('canvas'))).toBe(false);
  });
});

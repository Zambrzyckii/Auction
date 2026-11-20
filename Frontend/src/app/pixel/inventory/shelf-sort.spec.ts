import { ComponentFixture, TestBed } from '@angular/core/testing';
import type { ShelfItem } from './shelf-item';
import { ShelfSort } from './shelf-sort';

function item(id: string, status: string): ShelfItem {
  return { publicItemId: id, name: id, rarity: 'Common', status, officialPrice: 10 };
}

const avail = (id: string) => item(id, 'Available');
const locked = (id: string) => item(id, 'LockedForAuction');

describe('ShelfSort', () => {
  let fixture: ComponentFixture<ShelfSort>;
  let host: HTMLElement;
  let cmp: ShelfSort;

  function setInput(name: string, value: unknown): void {
    fixture.componentRef.setInput(name, value);
    fixture.detectChanges();
  }

  function detect(): void {
    fixture.detectChanges();
  }

  function tally(): string {
    return (host.querySelector('p.tally')?.textContent ?? '').replace(/\s+/g, ' ').trim();
  }

  function button(text: string): HTMLButtonElement {
    const found = Array.from(host.querySelectorAll<HTMLButtonElement>('div.sort button')).find(
      (b) => b.textContent?.trim() === text,
    );
    if (!found) throw new Error(`No sort button "${text}"`);
    return found;
  }

  function dirButton(): HTMLButtonElement {
    return host.querySelector<HTMLButtonElement>('div.sort button.dir')!;
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [ShelfSort] }).compileComponents();
    fixture = TestBed.createComponent(ShelfSort);
    host = fixture.nativeElement;
    cmp = fixture.componentInstance;
    setInput('items', []);
  });

  it('counts the items and the locked ones', () => {
    setInput('items', [avail('a'), locked('b'), avail('c')]);
    expect(tally()).toBe('3 items · 1 locked');
  });

  it('says item for one', () => {
    setInput('items', [avail('a')]);
    expect(tally()).toBe('1 item · 0 locked');
  });

  it('starts on rarity, best first', () => {
    expect(cmp.key()).toBe('rarity');
    expect(cmp.dir()).toBe('desc');
    expect(button('Rarity').getAttribute('aria-pressed')).toBe('true');
    expect(button('Name').getAttribute('aria-pressed')).toBe('false');
    expect(dirButton().textContent?.trim()).toBe('Best first');
    expect(dirButton().dataset['dir']).toBe('desc');
  });

  it('switches to another key in its natural direction', () => {
    button('Name').click();
    detect();
    expect(cmp.key()).toBe('name');
    expect(cmp.dir()).toBe('asc');
    expect(dirButton().textContent?.trim()).toBe('A to Z');
    expect(button('Name').getAttribute('aria-pressed')).toBe('true');
  });

  it('flips the direction on a second press of the active key', () => {
    button('Name').click();
    detect();
    button('Name').click();
    detect();
    expect(cmp.dir()).toBe('desc');
    expect(dirButton().textContent?.trim()).toBe('Z to A');
  });

  it('flips the direction from the direction button', () => {
    dirButton().click();
    detect();
    expect(cmp.dir()).toBe('asc');
    expect(dirButton().textContent?.trim()).toBe('Worst first');
  });
});

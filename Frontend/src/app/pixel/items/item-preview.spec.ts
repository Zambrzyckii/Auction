import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ItemPreview, PreviewItem } from './item-preview';

const items: readonly PreviewItem[] = [
  { publicItemId: 'e', name: 'Signed Game Ball', rarity: 'Epic', officialPrice: 5234 },
];

describe('ItemPreview', () => {
  let fixture: ComponentFixture<ItemPreview>;
  let host: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [ItemPreview] }).compileComponents();
    fixture = TestBed.createComponent(ItemPreview);
    host = fixture.nativeElement;
  });

  function render(picked: string): void {
    fixture.componentRef.setInput('items', items);
    fixture.componentRef.setInput('picked', picked);
    fixture.detectChanges();
  }

  function text(selector: string): string | undefined {
    return host.querySelector(selector)?.textContent?.trim();
  }

  function expectEmptySlot(): void {
    expect(text('.hint')).toBe('No item picked yet');
    expect(host.querySelector('.slot')).not.toBeNull();
    expect(host.querySelector('app-item-tile')).toBeNull();
  }

  it('shows the empty slot with no pick', () => {
    render('');
    expectEmptySlot();
  });

  it('shows the empty slot for an unknown id', () => {
    render('zzz');
    expectEmptySlot();
  });

  it('shows the picked item', () => {
    render('e');
    expect(text('.name')).toBe('Signed Game Ball');
    expect(text('span.rarity')).toBe('Epic');
    expect(host.querySelector('span.rarity')?.getAttribute('data-rarity')).toBe('Epic');
    expect(text('.price')).toBe('Official price 5,234');
    expect(host.querySelectorAll('app-item-tile.lot').length).toBe(1);
  });

  it('adds no form controls', () => {
    render('');
    expect(host.querySelector('input, option, button')).toBeNull();
    render('e');
    expect(host.querySelector('input, option, button')).toBeNull();
  });
});

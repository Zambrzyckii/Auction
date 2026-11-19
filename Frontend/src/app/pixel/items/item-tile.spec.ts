import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ItemTile } from './item-tile';

describe('ItemTile', () => {
  let fixture: ComponentFixture<ItemTile>;
  let host: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [ItemTile] }).compileComponents();
    fixture = TestBed.createComponent(ItemTile);
    host = fixture.nativeElement;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('renders a canvas hidden from assistive tech and the rarity ground', () => {
    fixture.componentRef.setInput('name', 'Old Radio');
    fixture.componentRef.setInput('rarity', 'Epic');
    fixture.detectChanges();
    expect(
      host.querySelector('canvas[aria-hidden="true"][width="32"][height="32"]'),
    ).not.toBeNull();
    expect(host.getAttribute('data-rarity')).toBe('Epic');
    expect(host.classList.contains('lot')).toBe(false);
  });

  it('renders with a null name and an unknown rarity', () => {
    fixture.componentRef.setInput('name', null);
    fixture.componentRef.setInput('rarity', 'Mythic');
    fixture.componentRef.setInput('size', 'lot');
    fixture.detectChanges();
    expect(host.getAttribute('data-rarity')).toBe('Common');
    expect(host.classList.contains('lot')).toBe(true);
  });

  it('asks for no 2d context without ResizeObserver', async () => {
    vi.stubGlobal('ResizeObserver', undefined);
    const getContext = vi.spyOn(HTMLCanvasElement.prototype, 'getContext');
    fixture.componentRef.setInput('name', 'Old Radio');
    fixture.detectChanges();
    await fixture.whenStable();
    expect(getContext).not.toHaveBeenCalled();
  });
});

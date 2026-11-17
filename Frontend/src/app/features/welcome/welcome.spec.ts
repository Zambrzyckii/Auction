import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { StreetScene } from '../../street/street-scene';
import { Welcome } from './welcome';

describe('Welcome', () => {
  let fixture: ComponentFixture<Welcome>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Welcome],
      providers: [provideRouter([])],
    }).compileComponents();
    fixture = TestBed.createComponent(Welcome);
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
    vi.restoreAllMocks();
  });

  function el(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function links(selector: string): HTMLAnchorElement[] {
    return Array.from(el().querySelectorAll<HTMLAnchorElement>(selector));
  }

  it('offers the three calls to action', () => {
    const ctas = links('.ctas a');

    expect(ctas.map((a) => a.textContent?.trim())).toEqual([
      'Start with $300',
      'Log in',
      'Browse auctions',
    ]);
    expect(ctas.map((a) => a.getAttribute('href'))).toEqual(['/register', '/login', '/auctions']);
  });

  it('lists every building as a plain link in street order', () => {
    const buildings = links('nav[aria-label="Street buildings"] a');

    expect(buildings.map((a) => a.textContent?.trim())).toEqual([
      'Your room',
      'Auction hall',
      'Pawnshop',
      'Checks cashed',
      'Card room',
      'Storage yard',
    ]);
    expect(buildings.map((a) => a.getAttribute('href'))).toEqual([
      '/inventory',
      '/auctions',
      '/pawnshop',
      '/bank',
      '/casino',
      '/warehouses',
    ]);
  });

  it('opens the page of a building picked on the street', () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    const scene = fixture.debugElement.query((d) => d.componentInstance instanceof StreetScene);

    (scene.componentInstance as StreetScene).picked.emit('casino');

    expect(navigate).toHaveBeenCalledWith('/casino');
  });

  it('renders without the street when the browser cannot run it', async () => {
    await fixture.whenStable();

    expect(el().querySelector('canvas')).not.toBeNull();
  });
});

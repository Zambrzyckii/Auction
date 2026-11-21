import { ComponentFixture, TestBed } from '@angular/core/testing';
import { StreetScene } from './street-scene';

describe('StreetScene', () => {
  let fixture: ComponentFixture<StreetScene>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [StreetScene] }).compileComponents();
    fixture = TestBed.createComponent(StreetScene);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('renders the street canvas with its description', () => {
    vi.stubGlobal('matchMedia', undefined);
    fixture.detectChanges();
    const canvas: HTMLCanvasElement | null =
      fixture.nativeElement.querySelector('canvas[role="img"]');
    expect(canvas).not.toBeNull();
    expect(canvas?.getAttribute('aria-label')).toMatch(/^A street at dusk\./);
  });

  it('runs the guard after the first render and starts no scene without a 2d context', async () => {
    vi.stubGlobal('matchMedia', vi.fn());
    vi.stubGlobal('IntersectionObserver', vi.fn());
    const getContext = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);

    fixture.detectChanges();
    await fixture.whenStable();

    const root: HTMLElement = fixture.nativeElement;
    expect(getContext).toHaveBeenCalledTimes(1);
    expect(root.querySelector<HTMLElement>('.tip')?.hidden).toBe(true);
    expect(root.querySelector('canvas')?.style.width).toBe('');
  });

  it('accepts a reserve before the scene boots', async () => {
    vi.stubGlobal('matchMedia', vi.fn());
    vi.stubGlobal('IntersectionObserver', vi.fn());
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);

    fixture.componentRef.setInput('reserve', 237);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.componentInstance.reserve()).toBe(237);
  });

  it('accepts a hud input without a scene', async () => {
    vi.stubGlobal('matchMedia', vi.fn());
    fixture.componentRef.setInput('hud', {
      name: 'bob',
      cash: 500,
      level: 3,
      share: 0.4,
      nextAt: 16000,
    });
    expect(() => fixture.detectChanges()).not.toThrow();
    await fixture.whenStable();

    expect(fixture.componentInstance.hud()?.cash).toBe(500);
  });
});

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DoorScene } from './door-scene';

describe('DoorScene', () => {
  let fixture: ComponentFixture<DoorScene>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [DoorScene] }).compileComponents();
    fixture = TestBed.createComponent(DoorScene);
    fixture.componentRef.setInput('mode', 'login');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('renders a canvas hidden from assistive tech', () => {
    vi.stubGlobal('matchMedia', undefined);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('canvas[aria-hidden="true"]')).not.toBeNull();
  });

  it('starts no view and reports no strip without a 2d context', async () => {
    vi.stubGlobal('matchMedia', vi.fn());
    vi.stubGlobal('IntersectionObserver', vi.fn());
    vi.stubGlobal('ResizeObserver', vi.fn());
    const getContext = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    const strips: number[] = [];
    fixture.componentInstance.strip.subscribe((px) => strips.push(px));
    fixture.detectChanges();
    await fixture.whenStable();
    expect(getContext).toHaveBeenCalledTimes(1);
    expect(strips).toEqual([]);
    expect(fixture.nativeElement.querySelector('canvas').style.width).toBe('');
  });

  it('does not touch the canvas without ResizeObserver', async () => {
    vi.stubGlobal('matchMedia', vi.fn());
    vi.stubGlobal('IntersectionObserver', vi.fn());
    vi.stubGlobal('ResizeObserver', undefined);
    const getContext = vi.spyOn(HTMLCanvasElement.prototype, 'getContext');
    fixture.detectChanges();
    await fixture.whenStable();
    expect(getContext).not.toHaveBeenCalled();
  });
});

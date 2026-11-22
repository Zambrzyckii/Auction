import { ComponentFixture, TestBed } from '@angular/core/testing';
import type { HudState } from './hud';
import { StreetScene } from './street-scene';
import type { SceneHandle } from './street-boot';

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

  describe('fx forwarding', () => {
    const hudState: HudState = { name: 'bob', cash: 500, level: 3, share: 0.4, nextAt: 16000 };
    const event = {
      kind: 'event',
      at: 'auction',
      word: 'SOLD',
      amount: 4250,
      part: 'coin',
      coins: 20,
      bills: 5,
      spotlight: true,
    } as const;
    const levelup = {
      kind: 'levelup',
      from: hudState,
      hud: { ...hudState, level: 4 },
      reward: 160,
      pending: 160,
      rain: 24,
      crowdStop: 4,
    } as const;

    function attach(): { play: ReturnType<typeof vi.fn>; playLevelUp: ReturnType<typeof vi.fn> } {
      vi.stubGlobal('matchMedia', undefined);
      fixture.detectChanges();
      const play = vi.fn();
      const playLevelUp = vi.fn();
      const handle: SceneHandle = { resize: vi.fn(), destroy: vi.fn(), play, playLevelUp };
      (fixture.componentInstance as unknown as { handle: SceneHandle }).handle = handle;
      return { play, playLevelUp };
    }

    it('starts a level up before it hands the new hud to the scene', () => {
      attach();
      const calls: string[] = [];
      const handle: SceneHandle = {
        resize: vi.fn(),
        destroy: vi.fn(),
        setHud: () => calls.push('setHud'),
        playLevelUp: () => calls.push('playLevelUp'),
      };
      (fixture.componentInstance as unknown as { handle: SceneHandle }).handle = handle;

      fixture.componentRef.setInput('hud', levelup.hud);
      fixture.componentRef.setInput('fx', levelup);
      fixture.detectChanges();

      expect(calls).toEqual(['playLevelUp', 'setHud']);
    });

    it('forwards fx to the handle', () => {
      const { play, playLevelUp } = attach();

      fixture.componentRef.setInput('fx', event);
      fixture.detectChanges();
      expect(play).toHaveBeenCalledTimes(1);
      expect(play).toHaveBeenCalledWith(event);
      expect(playLevelUp).not.toHaveBeenCalled();

      fixture.componentRef.setInput('fx', levelup);
      fixture.detectChanges();
      expect(playLevelUp).toHaveBeenCalledTimes(1);
      expect(playLevelUp).toHaveBeenCalledWith(levelup);
      expect(play).toHaveBeenCalledTimes(1);

      fixture.componentRef.setInput('fx', null);
      fixture.detectChanges();
      expect(play).toHaveBeenCalledTimes(1);
      expect(playLevelUp).toHaveBeenCalledTimes(1);
    });
  });
});

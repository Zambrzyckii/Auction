import { TestBed } from '@angular/core/testing';
import { clock } from './clock';

describe('clock', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({});
  });

  afterEach(() => vi.useRealTimers());

  it('ticks every second with the current time', () => {
    vi.setSystemTime(1_000_000);
    const now = TestBed.runInInjectionContext(() => clock());
    expect(now()).toBe(1_000_000);
    vi.advanceTimersByTime(1000);
    expect(now()).toBe(1_001_000);
    vi.advanceTimersByTime(3000);
    expect(now()).toBe(1_004_000);
  });

  it('honours a custom period', () => {
    vi.setSystemTime(2_000_000);
    const now = TestBed.runInInjectionContext(() => clock(250));
    vi.advanceTimersByTime(249);
    expect(now()).toBe(2_000_000);
    vi.advanceTimersByTime(1);
    expect(now()).toBe(2_000_250);
  });
});

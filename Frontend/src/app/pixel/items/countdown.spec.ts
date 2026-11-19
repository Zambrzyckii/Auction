import { TestBed } from '@angular/core/testing';
import { Countdown } from './countdown';

describe('Countdown', () => {
  beforeEach(async () => {
    vi.useFakeTimers();
    await TestBed.configureTestingModule({ imports: [Countdown] }).compileComponents();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const make = () => {
    const fixture = TestBed.createComponent(Countdown);
    fixture.componentRef.setInput('endsOn', '2030-01-01T00:00:00Z');
    fixture.componentRef.setInput('format', (endsOn: string, now: number) => `${endsOn}@${now}`);
    fixture.detectChanges();
    return fixture;
  };

  it('renders exactly what the formatter returns', () => {
    vi.setSystemTime(1000);
    expect(make().nativeElement.textContent).toBe('2030-01-01T00:00:00Z@1000');
  });

  it('ticks once a second', () => {
    vi.setSystemTime(1000);
    const fixture = make();
    vi.advanceTimersByTime(1000);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toBe('2030-01-01T00:00:00Z@2000');
  });

  it('two countdowns share one timer', () => {
    make();
    make();
    expect(vi.getTimerCount()).toBe(1);
  });

  it('the timer stops when the last countdown is destroyed', () => {
    const a = make();
    const b = make();
    a.destroy();
    expect(vi.getTimerCount()).toBe(1);
    b.destroy();
    expect(vi.getTimerCount()).toBe(0);
  });
});

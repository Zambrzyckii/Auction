import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { pushStub, PushStub } from '../../../testing/push-stub';
import { MyWarehouse } from '../../core/api/models';
import { PushClient } from '../../core/push/push-client';
import { WarehouseHistory } from './warehouse-history';

const URL = '/api/warehouses/mine';

function war(overrides: Partial<MyWarehouse>): MyWarehouse {
  return {
    publicWarehouseId: 'war-1',
    tier: 'Small',
    status: 'Settled',
    entryFee: 500,
    currentPrice: 60,
    itemCount: 4,
    players: 3,
    biddingEndsOn: null,
    isLeader: true,
    participantState: 'Active',
    cancellationReason: null,
    ...overrides,
  };
}

describe('WarehouseHistory', () => {
  let fixture: ComponentFixture<WarehouseHistory>;
  let http: HttpTestingController;
  let push: PushStub;

  beforeEach(async () => {
    vi.useFakeTimers();
    push = pushStub();
    await TestBed.configureTestingModule({
      imports: [WarehouseHistory],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: PushClient, useValue: push },
      ],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(WarehouseHistory);
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
    http.verify();
    vi.useRealTimers();
  });

  function el(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  it('requests the own wars without a limit parameter', () => {
    http.expectOne(URL).flush([]);
  });

  it('shows one outcome per war with the reason and a detail link', () => {
    http.expectOne(URL).flush([
      war({ publicWarehouseId: 'w-1' }),
      war({ publicWarehouseId: 'w-2', isLeader: false }),
      war({ publicWarehouseId: 'w-3', status: 'Bidding', isLeader: false, currentPrice: 20 }),
      war({
        publicWarehouseId: 'w-4',
        status: 'Cancelled',
        isLeader: false,
        cancellationReason: 'Lobby timed out',
      }),
    ]);
    fixture.detectChanges();
    const outcomes = Array.from(el().querySelectorAll('table.history td.outcome')).map((cell) =>
      cell.textContent?.trim(),
    );
    expect(outcomes).toEqual(['won', 'lost', 'running', 'cancelled']);
    expect(el().textContent).toContain('Lobby timed out');
    expect(el().querySelector('a[href="/warehouses/w-3"]')).not.toBeNull();
  });

  it('polls again after ten seconds', () => {
    http.expectOne(URL).flush([]);
    fixture.detectChanges();
    vi.advanceTimersByTime(10_000);
    http.expectOne(URL).flush([war({ tier: 'Medium' })]);
    fixture.detectChanges();
    expect(el().textContent).toContain('Medium');
  });

  it('shows the empty state', () => {
    http.expectOne(URL).flush([]);
    fixture.detectChanges();
    expect(el().textContent).toContain('You have not joined any warehouse war yet');
  });

  it('shows the normalized error on a gateway failure', () => {
    http.expectOne(URL).flush('<html>502</html>', { status: 502, statusText: 'Bad Gateway' });
    fixture.detectChanges();
    const error = el().querySelector('.error')?.textContent ?? '';
    expect(error.length).toBeGreaterThan(0);
    expect(error).not.toContain('<');
  });

  it('refreshes the own wars on WarehouseChanged', () => {
    http.expectOne(URL).flush([]);
    push.emit('WarehouseChanged', '{"warehouseId":"war-1"}');
    http.expectOne(URL).flush([war({})]);
    fixture.detectChanges();
    expect(el().textContent).not.toContain('You have not joined any warehouse war yet');
  });
});

import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { installStorageStub } from '../../../testing/storage-stub';
import { tokenWithClaims } from '../../../testing/token-fixture';
import { Wallet, WarehouseDetails } from '../../core/api/models';
import { TokenStorage } from '../../core/auth/token-storage';
import { WarehouseDetail } from './warehouse-detail';

const MY_ID = '26a451d4-dd74-4a58-859f-636aca258443';
const WAR_URL = '/api/warehouses/war-1';
const WALLET_URL = `/api/wallets/${MY_ID}`;

function war(overrides: Partial<WarehouseDetails>): WarehouseDetails {
  return {
    publicWarehouseId: 'war-1',
    tier: 'Small',
    status: 'Open',
    estimateMin: 400,
    estimateMax: 900,
    entryFee: 500,
    currentPrice: 0,
    itemCount: 4,
    players: 1,
    maxPlayers: 5,
    biddingStartsOn: null,
    biddingEndsOn: null,
    isParticipant: false,
    participantState: null,
    isLeader: false,
    cancellationReason: null,
    manifest: null,
    ...overrides,
  };
}

function wallet(overrides: Partial<Wallet>): Wallet {
  return { availableFunds: 1000, lockedFunds: 0, lifetimeTurnover: 0, ...overrides };
}

describe('WarehouseDetail', () => {
  let fixture: ComponentFixture<WarehouseDetail>;
  let http: HttpTestingController;

  beforeEach(async () => {
    vi.useFakeTimers();
    installStorageStub();
    new TokenStorage().set(
      tokenWithClaims({ nameid: MY_ID, exp: Math.floor(Date.now() / 1000) + 600 }),
    );
    await TestBed.configureTestingModule({
      imports: [WarehouseDetail],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ id: 'war-1' }) } },
        },
      ],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(WarehouseDetail);
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

  function flushAll(state: WarehouseDetails, funds: Wallet = wallet({})): void {
    http.expectOne(WAR_URL).flush(state);
    http.expectOne(WALLET_URL).flush(funds);
    fixture.detectChanges();
  }

  it('shows the war header with the price, the budget and the players', () => {
    flushAll(war({ currentPrice: 60, status: 'Bidding' }));
    const text = el().textContent ?? '';
    expect(text).toContain('Small warehouse war');
    expect(text).toContain('Status: Bidding');
    expect(text).toContain('400–900 across 4 items');
    expect(el().querySelector('.current-price')?.textContent).toBe('60');
    expect(text).toContain('budget: 500');
    expect(el().querySelector('.unknown-tier')).toBeNull();
  });

  it('marks a tier missing from the client table', () => {
    flushAll(war({ tier: 'Haunted' }));
    expect(el().querySelector('.unknown-tier')?.textContent).toContain('Unknown tier');
  });

  it('counts down to the bidding start and the window close', () => {
    flushAll(
      war({ biddingStartsOn: new Date(Date.now() + 25_000).toISOString(), players: 3 }),
    );
    expect(el().querySelector('.starts-in')?.textContent).toContain(
      'Bidding starts in 0 min 25 s',
    );

    vi.advanceTimersByTime(2000);
    http
      .expectOne(WAR_URL)
      .flush(
        war({ status: 'Bidding', currentPrice: 10, biddingEndsOn: new Date(Date.now() + 9000).toISOString() }),
      );
    fixture.detectChanges();
    expect(el().querySelector('.closes-in')?.textContent).toContain(
      'Raise window closes in 0 min 9 s',
    );
    expect(el().querySelector('.someone-leads')).not.toBeNull();
  });

  it('shows the pending entry confirmation and the leader line', () => {
    flushAll(war({ isParticipant: true, participantState: 'PendingLock' }));
    expect(el().querySelector('.pending-lock')?.textContent).toContain(
      'Confirming your entry fee…',
    );

    vi.advanceTimersByTime(5000);
    http.expectOne(WALLET_URL).flush(wallet({}));
    http
      .expectOne(WAR_URL)
      .flush(
        war({
          status: 'Bidding',
          isParticipant: true,
          participantState: 'Active',
          isLeader: true,
          currentPrice: 10,
          biddingEndsOn: new Date(Date.now() + 9000).toISOString(),
        }),
      );
    fixture.detectChanges();
    expect(el().querySelector('.leading')?.textContent).toContain('You are leading');
    expect(el().querySelector('.someone-leads')).toBeNull();
  });

  it('shows the manifest and the win line once settled, then stops polling', () => {
    flushAll(
      war({
        status: 'Settled',
        isParticipant: true,
        participantState: 'Active',
        isLeader: true,
        currentPrice: 110,
        manifest: [{ name: 'Warehouse Small Find', rarity: 'Common', price: 120 }],
      }),
    );
    expect(el().textContent).toContain('You won, the items reach your inventory in a few seconds');
    const rows = el().querySelectorAll('table.manifest tr');
    expect(rows.length).toBe(2);
    expect(rows[1].textContent).toContain('Warehouse Small Find');

    vi.advanceTimersByTime(20_000);
    http.expectNone(WAR_URL);
    http.expectNone(WALLET_URL);
  });

  it('joins the war, confirms the fee and offers the leave', () => {
    flushAll(war({}));
    (el().querySelector('button.join') as HTMLButtonElement).click();

    const post = http.expectOne('/api/warehouses/war-1/join');
    expect(post.request.method).toBe('POST');
    post.flush(null);
    fixture.detectChanges();

    http.expectOne(WAR_URL).flush(war({ isParticipant: true, participantState: 'PendingLock', players: 1 }));
    http.expectOne(WALLET_URL).flush(wallet({ lockedFunds: 500 }));
    fixture.detectChanges();
    expect(el().querySelector('.pending-lock')?.textContent).toContain(
      'Confirming your entry fee…',
    );
    expect(el().querySelector('button.join')).toBeNull();
    expect(el().querySelector('button.leave')).not.toBeNull();
  });

  it('blocks the join without the entry fee', () => {
    flushAll(war({}), wallet({ availableFunds: 300 }));
    expect((el().querySelector('button.join') as HTMLButtonElement).disabled).toBe(true);
    expect(el().querySelector('.join-problem')?.textContent).toContain(
      'Not enough funds on account',
    );
  });

  it('leaves the war and clears the join marker', () => {
    flushAll(war({ isParticipant: true, participantState: 'Active', players: 1 }));
    (el().querySelector('button.leave') as HTMLButtonElement).click();

    http.expectOne('/api/warehouses/war-1/leave').flush(null);
    fixture.detectChanges();
    http.expectOne(WAR_URL).flush(war({}));
    http.expectOne(WALLET_URL).flush(wallet({}));
    fixture.detectChanges();
    expect(el().querySelector('button.leave')).toBeNull();
    expect(el().querySelector('.entry-rejected')).toBeNull();
  });

  it('reports a silently rejected entry fee', () => {
    flushAll(war({}));
    (el().querySelector('button.join') as HTMLButtonElement).click();
    http.expectOne('/api/warehouses/war-1/join').flush(null);
    fixture.detectChanges();
    http.expectOne(WAR_URL).flush(war({ isParticipant: true, participantState: 'PendingLock', players: 1 }));
    http.expectOne(WALLET_URL).flush(wallet({}));
    fixture.detectChanges();

    vi.advanceTimersByTime(5000);
    http.expectOne(WAR_URL).flush(war({ players: 0 }));
    http.expectOne(WALLET_URL).flush(wallet({}));
    fixture.detectChanges();
    expect(el().querySelector('.entry-rejected')?.textContent).toContain(
      'Your entry was not confirmed, most likely not enough funds',
    );
  });

  it('tells a losing participant about the refund and shows a cancellation', () => {
    flushAll(
      war({ status: 'Settled', isParticipant: true, participantState: 'Active', currentPrice: 110, manifest: [] }),
    );
    expect(el().textContent).toContain('Your entry fee is being refunded');
  });

  it('shows the cancellation reason', () => {
    flushAll(war({ status: 'Cancelled', cancellationReason: 'Lobby timed out below the player minimum' }));
    expect(el().querySelector('.cancellation')?.textContent).toContain(
      'Lobby timed out below the player minimum',
    );
    vi.advanceTimersByTime(20_000);
    http.expectNone(WAR_URL);
  });
});

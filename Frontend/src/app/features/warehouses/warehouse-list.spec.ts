import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { installStorageStub } from '../../../testing/storage-stub';
import { tokenWithClaims } from '../../../testing/token-fixture';
import { WarehouseInvite, WarehouseSummary } from '../../core/api/models';
import { TokenStorage } from '../../core/auth/token-storage';
import { ProfileDirectory } from '../../core/profiles/profile-directory';
import { WarehouseList } from './warehouse-list';

const MY_ID = '26a451d4-dd74-4a58-859f-636aca258443';
const LIST_URL = '/api/warehouses?limit=20';
const INVITES_URL = '/api/profiles/warehouse-invites';

function war(overrides: Partial<WarehouseSummary>): WarehouseSummary {
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
    ...overrides,
  };
}

function invite(overrides: Partial<WarehouseInvite>): WarehouseInvite {
  return {
    publicInviteId: 'inv-1',
    publicWarehouseId: 'war-1',
    inviterUserId: 'deadbeef-1111-2222-3333-444444444444',
    inviterUsername: 'inviter-a',
    createdOn: new Date(Date.now() - 60_000).toISOString(),
    expiresOn: new Date(Date.now() + 840_000).toISOString(),
    ...overrides,
  };
}

describe('WarehouseList', () => {
  let fixture: ComponentFixture<WarehouseList>;
  let http: HttpTestingController;
  let remember: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.useFakeTimers();
    installStorageStub();
    new TokenStorage().set(
      tokenWithClaims({ nameid: MY_ID, exp: Math.floor(Date.now() / 1000) + 600 }),
    );
    remember = vi.fn();
    await TestBed.configureTestingModule({
      imports: [WarehouseList],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: ProfileDirectory, useValue: { remember } },
      ],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(WarehouseList);
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

  function flushAll(wars: WarehouseSummary[], invites: WarehouseInvite[] = []): void {
    http.expectOne(LIST_URL).flush(wars);
    http.expectOne(INVITES_URL).flush(invites);
    fixture.detectChanges();
  }

  it('lists the wars with the tier, the players and a countdown', () => {
    flushAll([
      war({}),
      war({
        publicWarehouseId: 'war-2',
        tier: 'Medium',
        status: 'Bidding',
        currentPrice: 150,
        biddingEndsOn: new Date(Date.now() + 8000).toISOString(),
      }),
    ]);
    const rows = el().querySelectorAll('table.wars tr');
    expect(rows.length).toBe(3);
    expect(rows[1].textContent).toContain('Small');
    expect(rows[1].textContent).toContain('1/5 including unconfirmed');
    expect(rows[2].textContent).toContain('window closes in 0 min 8 s');
    expect(rows[2].querySelector('a[href="/warehouses/war-2"]')).not.toBeNull();
  });

  it('shows a countdown to the bidding start of a filling lobby', () => {
    flushAll([war({ biddingStartsOn: new Date(Date.now() + 25_000).toISOString(), players: 3 })]);
    expect(el().textContent).toContain('bidding starts in 0 min 25 s');
  });

  it('lists the invites with the inviter, a link and the server expiry', () => {
    flushAll([], [invite({ expiresOn: new Date(Date.now() + 300_000).toISOString() })]);
    const item = el().querySelector('.invites li');
    expect(item?.textContent).toContain('inviter-a invites you');
    expect(item?.textContent).toContain('expires in 5 min 0 s');
    expect(item?.querySelector('a[href="/warehouses/war-1"]')).not.toBeNull();
    expect(remember).toHaveBeenCalledWith('deadbeef-1111-2222-3333-444444444444', 'inviter-a');
  });

  it('filters out an invite whose server expiry has passed', () => {
    flushAll(
      [],
      [
        invite({}),
        invite({
          publicInviteId: 'inv-9',
          publicWarehouseId: 'war-9',
          inviterUsername: 'inviter-b',
          expiresOn: new Date(Date.now() - 1000).toISOString(),
        }),
      ],
    );
    expect(el().querySelectorAll('.invites li').length).toBe(1);
    expect(el().textContent).not.toContain('inviter-b');
  });

  it('declines an invite and refreshes the list at once', () => {
    flushAll([], [invite({})]);
    (el().querySelector('.invites button.decline') as HTMLButtonElement).click();
    const post = http.expectOne({ method: 'POST', url: `${INVITES_URL}/inv-1/decline` });
    expect(post.request.body).toBeNull();
    post.flush(null);
    http.expectOne(INVITES_URL).flush([]);
    fixture.detectChanges();
    expect(el().querySelector('.invites')).toBeNull();
  });

  it('shows the server text when the decline is refused', () => {
    flushAll([], [invite({})]);
    (el().querySelector('.invites button.decline') as HTMLButtonElement).click();
    http
      .expectOne({ method: 'POST', url: `${INVITES_URL}/inv-1/decline` })
      .flush({ error: 'Warehouse invite was not found' }, { status: 404, statusText: 'Not Found' });
    fixture.detectChanges();
    expect(el().querySelector('.invite-notice')?.textContent).toContain(
      'Warehouse invite was not found',
    );
  });

  it('shows the empty state', () => {
    flushAll([]);
    expect(el().textContent).toContain('No warehouse wars right now.');
    expect(el().querySelector('.invites')).toBeNull();
  });

  it('links to the war history', () => {
    flushAll([]);
    expect(el().querySelector('a[href="/warehouses/mine"]')).not.toBeNull();
  });
});

import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { WritableSignal, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { installStorageStub } from '../../../testing/storage-stub';
import { tokenWithClaims } from '../../../testing/token-fixture';
import { OwnProfile as OwnProfileDto, Transfer, Wallet } from '../../core/api/models';
import { TokenStorage } from '../../core/auth/token-storage';
import { ProfileDirectory, shortId } from '../../core/profiles/profile-directory';
import { Transfers } from './transfers';

const MY_ID = '26a451d4-dd74-4a58-859f-636aca258443';
const OTHER_ID = 'deadbeef-1111-2222-3333-444444444444';
const WALLET_URL = `/api/wallets/${MY_ID}`;
const HISTORY_URL = `/api/wallets/${MY_ID}/transfers`;
const ME_URL = '/api/profiles/me';

function wallet(overrides: Partial<Wallet>): Wallet {
  return { availableFunds: 300, lockedFunds: 0, lifetimeTurnover: 0, ...overrides };
}

function transfer(overrides: Partial<Transfer>): Transfer {
  return {
    senderUserId: MY_ID,
    recipientUserId: OTHER_ID,
    amount: 25.5,
    sentOn: '2026-11-12T10:00:00Z',
    ...overrides,
  };
}

function me(overrides: Partial<OwnProfileDto>): OwnProfileDto {
  return {
    userId: MY_ID,
    username: 'probe1',
    isPrivate: false,
    level: 2,
    memberSince: '2026-11-01T00:00:00Z',
    avatarUrl: null,
    friends: [],
    incomingFriendRequests: [],
    outgoingFriendRequests: [],
    socialLinks: [],
    ...overrides,
  };
}

describe('Transfers', () => {
  let fixture: ComponentFixture<Transfers>;
  let http: HttpTestingController;
  let directoryNames: WritableSignal<ReadonlyMap<string, string>>;
  let ensure: ReturnType<typeof vi.fn>;
  let remember: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.useFakeTimers();
    installStorageStub();
    new TokenStorage().set(
      tokenWithClaims({ nameid: MY_ID, exp: Math.floor(Date.now() / 1000) + 600 }),
    );
    directoryNames = signal<ReadonlyMap<string, string>>(new Map());
    ensure = vi.fn();
    remember = vi.fn();
    await TestBed.configureTestingModule({
      imports: [Transfers],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: ProfileDirectory,
          useValue: {
            ensure,
            remember,
            label: (userId: string) => directoryNames().get(userId) ?? shortId(userId),
            labelWithId: (userId: string) => {
              const name = directoryNames().get(userId);
              return name === undefined ? shortId(userId) : `${name} (${shortId(userId)})`;
            },
          },
        },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: convertToParamMap({}) } },
        },
      ],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(Transfers);
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

  function flushAll(rows: Transfer[]): void {
    http.expectOne(WALLET_URL).flush(wallet({}));
    http.expectOne(HISTORY_URL).flush(rows);
    http.expectOne(ME_URL).flush(me({}));
    fixture.detectChanges();
  }

  it('shows the available funds', () => {
    flushAll([]);
    expect(el().textContent).toContain('300');
  });

  it('lists the history with directions and directory labels', () => {
    directoryNames.set(new Map([[OTHER_ID, 'alice']]));
    flushAll([
      transfer({}),
      transfer({ senderUserId: OTHER_ID, recipientUserId: MY_ID, amount: 10 }),
    ]);
    const text = el().textContent ?? '';
    expect(text).toContain('Sent to');
    expect(text).toContain('Received from');
    expect(text).toContain('alice (deadbeef)');
    expect(text).toContain('25.5');
  });

  it('passes the other parties to the directory', () => {
    flushAll([transfer({}), transfer({ senderUserId: OTHER_ID, recipientUserId: MY_ID })]);
    expect(ensure).toHaveBeenCalledWith([OTHER_ID, OTHER_ID]);
  });

  it('remembers friends from the profile', () => {
    http.expectOne(WALLET_URL).flush(wallet({}));
    http.expectOne(HISTORY_URL).flush([]);
    http.expectOne(ME_URL).flush(me({ friends: [{ userId: OTHER_ID, username: 'alice' }] }));
    expect(remember).toHaveBeenCalledWith(OTHER_ID, 'alice');
  });

  it('polls the wallet at 5 s and the history at 10 s', () => {
    flushAll([]);
    vi.advanceTimersByTime(5000);
    http.expectOne(WALLET_URL).flush(wallet({ availableFunds: 280 }));
    vi.advanceTimersByTime(5000);
    http.expectOne(WALLET_URL).flush(wallet({ availableFunds: 280 }));
    http.expectOne(HISTORY_URL).flush([transfer({})]);
    fixture.detectChanges();
    expect(el().textContent).toContain('280');
    expect(el().textContent).toContain('Sent to');
  });

  describe('send form', () => {
    function fillForm(recipient: string, amount: string): void {
      const inputs = el().querySelectorAll('.send-form input');
      (inputs[0] as HTMLInputElement).value = recipient;
      inputs[0].dispatchEvent(new Event('input'));
      (inputs[1] as HTMLInputElement).value = amount;
      inputs[1].dispatchEvent(new Event('input'));
      fixture.detectChanges();
    }

    it('sends the transfer and refreshes the wallet and the history', () => {
      flushAll([]);
      fillForm(OTHER_ID, '25.5');
      (el().querySelector('button.send') as HTMLButtonElement).click();

      const post = http.expectOne('/api/wallets/transfers');
      expect(post.request.body).toEqual({ recipientUserId: OTHER_ID, amount: 25.5 });
      post.flush(null);
      fixture.detectChanges();
      expect(el().textContent).toContain('Sent.');

      http.expectOne(WALLET_URL).flush(wallet({ availableFunds: 274.5 }));
      http.expectOne(HISTORY_URL).flush([transfer({})]);
    });

    it('shows the recipient preview with the short id', () => {
      directoryNames.set(new Map([[OTHER_ID, 'alice']]));
      flushAll([]);
      fillForm(OTHER_ID, '10');
      expect(el().querySelector('.recipient-preview')?.textContent).toContain('alice (deadbeef)');
      expect(ensure).toHaveBeenCalledWith([OTHER_ID]);
    });

    it('warns about a recipient outside the friends list', () => {
      flushAll([]);
      fillForm(OTHER_ID, '10');
      expect(el().querySelector('.recipient-warning')?.textContent).toContain(
        'not on your friends list',
      );
    });

    it('stays quiet about a friend recipient', () => {
      http.expectOne(WALLET_URL).flush(wallet({}));
      http.expectOne(HISTORY_URL).flush([]);
      http.expectOne(ME_URL).flush(me({ friends: [{ userId: OTHER_ID, username: 'alice' }] }));
      fixture.detectChanges();
      fillForm(OTHER_ID, '10');
      expect(el().querySelector('.recipient-warning')).toBeNull();
    });

    it('blocks sending to myself with the validator text', () => {
      flushAll([]);
      fillForm(MY_ID, '10');
      expect((el().querySelector('button.send') as HTMLButtonElement).disabled).toBe(true);
      expect(el().textContent).toContain('Cannot transfer funds to yourself');
    });

    it('shows the server text on a rejected transfer and unblocks the button', () => {
      flushAll([]);
      fillForm(OTHER_ID, '25.5');
      (el().querySelector('button.send') as HTMLButtonElement).click();

      http
        .expectOne('/api/wallets/transfers')
        .flush({ error: 'Data corrupted, try again' }, { status: 409, statusText: 'Conflict' });
      fixture.detectChanges();
      expect(el().textContent).toContain('Data corrupted, try again');
      expect((el().querySelector('button.send') as HTMLButtonElement).disabled).toBe(false);
    });
  });
});

describe('Transfers with ?to=', () => {
  let http: HttpTestingController;

  it('prefills the recipient from the query parameter', async () => {
    vi.useFakeTimers();
    installStorageStub();
    new TokenStorage().set(
      tokenWithClaims({ nameid: MY_ID, exp: Math.floor(Date.now() / 1000) + 600 }),
    );
    await TestBed.configureTestingModule({
      imports: [Transfers],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: ProfileDirectory,
          useValue: { ensure: vi.fn(), remember: vi.fn(), label: shortId, labelWithId: shortId },
        },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: convertToParamMap({ to: OTHER_ID }) } },
        },
      ],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(Transfers);
    fixture.detectChanges();
    http.expectOne(WALLET_URL).flush(wallet({}));
    http.expectOne(HISTORY_URL).flush([]);
    http.expectOne(ME_URL).flush(me({}));
    fixture.detectChanges();

    const input = (fixture.nativeElement as HTMLElement).querySelector(
      '.send-form input',
    ) as HTMLInputElement;
    expect(input.value).toBe(OTHER_ID);

    fixture.destroy();
    http.verify();
    vi.useRealTimers();
  });
});

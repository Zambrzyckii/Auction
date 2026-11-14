import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { installStorageStub } from '../../../testing/storage-stub';
import { tokenWithClaims } from '../../../testing/token-fixture';
import { Loan, LoanOffer, Wallet } from '../../core/api/models';
import { TokenStorage } from '../../core/auth/token-storage';
import { Bank } from './bank';

const MY_ID = '26a451d4-dd74-4a58-859f-636aca258443';
const OFFERS_URL = '/api/bank/offers';
const LOANS_URL = '/api/bank/loans';
const WALLET_URL = `/api/wallets/${MY_ID}`;

function offer(overrides: Partial<LoanOffer>): LoanOffer {
  return {
    name: 'Quick',
    principal: 200,
    interestRate: 0.1,
    totalDue: 220,
    term: '00:01:00',
    requiredTurnover: 400,
    ...overrides,
  };
}

function loan(overrides: Partial<Loan>): Loan {
  return {
    publicLoanId: 'loan-1',
    offerName: 'Quick',
    principal: 200,
    interestRate: 0.1,
    totalDue: 220,
    penalty: 0,
    amountRepaid: 0,
    outstanding: 220,
    status: 'Active',
    requestedOn: '2026-11-12T10:00:00Z',
    dueOn: new Date(Date.now() + 60_000).toISOString(),
    overdueSince: null,
    repaidOn: null,
    rejectionReason: null,
    ...overrides,
  };
}

function wallet(overrides: Partial<Wallet>): Wallet {
  return { availableFunds: 300, lockedFunds: 0, lifetimeTurnover: 0, ...overrides };
}

describe('Bank', () => {
  let fixture: ComponentFixture<Bank>;
  let http: HttpTestingController;

  beforeEach(async () => {
    vi.useFakeTimers();
    installStorageStub();
    new TokenStorage().set(
      tokenWithClaims({ nameid: MY_ID, exp: Math.floor(Date.now() / 1000) + 600 }),
    );
    await TestBed.configureTestingModule({
      imports: [Bank],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(Bank);
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

  function flushAll(loans: Loan[]): void {
    http.expectOne(OFFERS_URL).flush([offer({})]);
    http.expectOne(LOANS_URL).flush(loans);
    http.expectOne(WALLET_URL).flush(wallet({}));
    fixture.detectChanges();
  }

  it('shows the offer catalog', () => {
    flushAll([]);
    const text = el().textContent ?? '';
    expect(text).toContain('Quick');
    expect(text).toContain('220');
    expect(text).toContain('400');
  });

  it('lists loans with a countdown to the due date', () => {
    flushAll([loan({})]);
    const text = el().textContent ?? '';
    expect(text).toContain('Active');
    expect(text).toMatch(/min.*s/);
  });

  it('shows the overdue retry note and the rejection reason', () => {
    flushAll([
      loan({ status: 'Overdue', overdueSince: '2026-11-12T10:05:00Z', penalty: 44 }),
      loan({
        publicLoanId: 'loan-2',
        status: 'Rejected',
        rejectionReason: 'Lifetime turnover 0 is below the required 400',
      }),
    ]);
    const text = el().textContent ?? '';
    expect(text).toContain('The bank retries collection every 2 minutes');
    expect(text).toContain('below the required 400');
  });

  it('requests a loan with the exact offer name and refreshes', () => {
    http.expectOne(OFFERS_URL).flush([offer({})]);
    http.expectOne(LOANS_URL).flush([]);
    http.expectOne(WALLET_URL).flush(wallet({ lifetimeTurnover: 400 }));
    fixture.detectChanges();
    (el().querySelector('button.request-loan') as HTMLButtonElement).click();

    const post = http.expectOne(LOANS_URL);
    expect(post.request.method).toBe('POST');
    expect(post.request.body).toEqual({ offerName: 'Quick' });
    post.flush({ publicLoanId: 'loan-9' }, { status: 201, statusText: 'Created' });
    fixture.detectChanges();
    expect(el().querySelector('.bank-notice')).toBeNull();

    http.expectOne(LOANS_URL).flush([loan({ status: 'PendingApproval', dueOn: null })]);
    fixture.detectChanges();
    expect(el().textContent).toContain('Loan requested, waiting for approval…');
    expect(el().textContent).toContain('PendingApproval');

    vi.advanceTimersByTime(2000);
    http.expectOne(LOANS_URL).flush([loan({})]);
    fixture.detectChanges();
    expect(el().textContent).not.toContain('Loan requested, waiting for approval…');
  });

  it('blocks the offer while a loan is open', () => {
    http.expectOne(OFFERS_URL).flush([offer({})]);
    http.expectOne(LOANS_URL).flush([loan({ status: 'Active' })]);
    http.expectOne(WALLET_URL).flush(wallet({ lifetimeTurnover: 400 }));
    fixture.detectChanges();
    expect((el().querySelector('button.request-loan') as HTMLButtonElement).disabled).toBe(true);
    expect(el().textContent).toContain('User already has an open loan');
  });

  it('repays a running loan and keeps the button disabled while collecting', () => {
    flushAll([loan({})]);
    (el().querySelector('button.repay') as HTMLButtonElement).click();

    const post = http.expectOne(`${LOANS_URL}/loan-1/repayments`);
    expect(post.request.method).toBe('POST');
    expect(post.request.body).toBeNull();
    post.flush(null, { status: 202, statusText: 'Accepted' });
    fixture.detectChanges();
    expect(el().textContent).not.toContain('Collection requested…');

    http.expectOne(LOANS_URL).flush([loan({ status: 'CollectionPending' })]);
    fixture.detectChanges();
    expect(el().textContent).toContain('Collection requested…');
    expect((el().querySelector('button.repay') as HTMLButtonElement).disabled).toBe(true);

    vi.advanceTimersByTime(2000);
    http.expectOne(LOANS_URL).flush([loan({ status: 'Repaid', repaidOn: '2026-11-14T10:00:00Z' })]);
    fixture.detectChanges();
    expect(el().textContent).not.toContain('Collection requested…');
    expect(el().querySelector('button.repay')).toBeNull();
  });

  it('offers no repay button for a loan that is not running', () => {
    flushAll([
      loan({ status: 'PendingApproval', dueOn: null }),
      loan({ publicLoanId: 'loan-2', status: 'Repaid', repaidOn: '2026-11-12T10:01:00Z' }),
      loan({ publicLoanId: 'loan-3', status: 'Rejected', rejectionReason: 'Not enough' }),
    ]);
    expect(el().querySelector('button.repay')).toBeNull();
  });

  it('shows the server text when the repayment is refused', () => {
    flushAll([loan({ status: 'Overdue', overdueSince: '2026-11-12T10:05:00Z' })]);
    (el().querySelector('button.repay') as HTMLButtonElement).click();
    http
      .expectOne(`${LOANS_URL}/loan-1/repayments`)
      .flush(
        { error: 'A collection for this loan is already in progress' },
        { status: 409, statusText: 'Conflict' },
      );
    fixture.detectChanges();
    expect(el().textContent).toContain('A collection for this loan is already in progress');
    expect((el().querySelector('button.repay') as HTMLButtonElement).disabled).toBe(false);
  });

  it('previews the repayment next to the button', () => {
    flushAll([loan({})]);
    expect(el().textContent).toContain('This collects 220 now and repays the loan');
  });

  it('polls loans every 2 seconds while one is pending approval', () => {
    flushAll([loan({ status: 'PendingApproval', dueOn: null })]);
    vi.advanceTimersByTime(2000);
    http.expectOne(LOANS_URL).flush([loan({})]);
    fixture.detectChanges();
    expect(el().textContent).toContain('Active');
    vi.advanceTimersByTime(3000);
    http.expectOne(WALLET_URL).flush(wallet({}));
    vi.advanceTimersByTime(2000);
    http.expectOne(LOANS_URL).flush([loan({})]);
  });
});

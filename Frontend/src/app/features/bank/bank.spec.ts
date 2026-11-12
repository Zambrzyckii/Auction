import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { installStorageStub } from '../../../testing/storage-stub';
import { tokenWithClaims } from '../../../testing/token-fixture';
import { Loan, LoanOffer, Wallet } from '../../core/api/models';
import { TokenStorage } from '../../core/auth/token-storage';
import { Bank, loansPollMs } from './bank';

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

describe('loansPollMs', () => {
  it('polls fast while a loan waits for the bank', () => {
    expect(loansPollMs([loan({ status: 'PendingApproval' })])).toBe(2000);
    expect(loansPollMs([loan({ status: 'CollectionPending' })])).toBe(2000);
  });

  it('polls slow otherwise', () => {
    expect(loansPollMs(null)).toBe(5000);
    expect(loansPollMs([])).toBe(5000);
    expect(loansPollMs([loan({ status: 'Active' }), loan({ status: 'Repaid' })])).toBe(5000);
  });
});

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

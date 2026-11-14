import { Loan, LoanOffer, Wallet } from '../../core/api/models';
import { loansPollMs, offerBlockReason, repayHint } from './bank-rules';

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

describe('offerBlockReason', () => {
  it('allows an offer within the turnover and with no open loan', () => {
    expect(offerBlockReason(offer({}), wallet({ lifetimeTurnover: 400 }), [])).toBeNull();
    expect(
      offerBlockReason(offer({}), wallet({ lifetimeTurnover: 500 }), [
        loan({ status: 'Repaid' }),
        loan({ status: 'Rejected' }),
      ]),
    ).toBeNull();
  });

  it('blocks every open loan status with the server text', () => {
    const funds = wallet({ lifetimeTurnover: 1000 });
    for (const status of ['PendingApproval', 'Active', 'CollectionPending', 'Overdue'] as const) {
      expect(offerBlockReason(offer({}), funds, [loan({ status })])).toBe(
        'User already has an open loan',
      );
    }
  });

  it('blocks a turnover below the requirement and names both numbers', () => {
    const reason = offerBlockReason(offer({}), wallet({ lifetimeTurnover: 100 }), []);
    expect(reason).toBe('Needs lifetime turnover 400, you have 100');
  });
});

describe('repayHint', () => {
  it('previews nothing for a loan the bank cannot collect now', () => {
    const funds = wallet({ availableFunds: 1000 });
    for (const status of ['PendingApproval', 'CollectionPending', 'Repaid', 'Rejected'] as const) {
      expect(repayHint(loan({ status }), funds)).toBeNull();
    }
  });

  it('repays the outstanding debt with the penalty and earlier repayments counted', () => {
    const funds = wallet({ availableFunds: 1000 });
    const overdue = loan({ status: 'Overdue', penalty: 44, outstanding: 264 });
    expect(repayHint(overdue, funds)).toBe('This collects 264 now and repays the loan');
    const partlyRepaid = loan({ amountRepaid: 50, outstanding: 170 });
    expect(repayHint(partlyRepaid, funds)).toBe('This collects 170 now and repays the loan');
  });

  it('collects only the available funds, never the locked ones', () => {
    const funds = wallet({ availableFunds: 100, lockedFunds: 500 });
    expect(repayHint(loan({ outstanding: 220 }), funds)).toBe(
      'This collects 100 now, the rest stays outstanding',
    );
  });

  it('says there is nothing to collect when the available funds are zero', () => {
    const funds = wallet({ availableFunds: 0, lockedFunds: 300 });
    expect(repayHint(loan({ outstanding: 220 }), funds)).toBe(
      'Nothing to collect now, your available funds are 0',
    );
  });
});

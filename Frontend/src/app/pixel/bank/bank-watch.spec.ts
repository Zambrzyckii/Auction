import { loanSteps, MAX_WIRES, newestLoan, slipsOf, STAGED_KINDS, wireSteps } from './bank-watch';
import type { BankLoan, BankStep, WireRow } from './bank-watch';

const NOW = Date.parse('2026-11-23T12:00:00Z');

const loan = (over: Partial<BankLoan> = {}): BankLoan => ({
  publicLoanId: 'l1',
  principal: 200,
  totalDue: 220,
  penalty: 0,
  amountRepaid: 0,
  outstanding: 220,
  status: 'Active',
  dueOn: '2026-11-23T12:01:00Z',
  overdueSince: null,
  rejectionReason: null,
  ...over,
});

const matured = (over: Partial<BankLoan> = {}): BankLoan =>
  loan({ dueOn: '2026-11-23T11:59:00Z', ...over });

const overdue = (over: Partial<BankLoan> = {}): BankLoan =>
  matured({
    status: 'Overdue',
    overdueSince: '2026-11-23T11:59:30Z',
    penalty: 44,
    outstanding: 264,
    ...over,
  });

const pending = (over: Partial<BankLoan> = {}): BankLoan =>
  loan({ status: 'PendingApproval', dueOn: null, ...over });

const collecting = (over: Partial<BankLoan> = {}): BankLoan =>
  loan({ status: 'CollectionPending', ...over });

const repaid = (over: Partial<BankLoan> = {}): BankLoan =>
  loan({ status: 'Repaid', amountRepaid: 220, outstanding: 0, ...over });

const steps = (
  before: BankLoan | null,
  after: BankLoan | null,
  asked = false,
): readonly BankStep[] => loanSteps(before, after, asked, NOW);

describe('loanSteps', () => {
  it('gives nothing when there is no newest loan', () => {
    expect(steps(loan(), null)).toEqual([]);
    expect(steps(null, null)).toEqual([]);
  });

  describe('a new loan', () => {
    it('requests a pending loan', () => {
      const after = pending();
      expect(steps(null, after)).toEqual([{ kind: 'requested', loan: after }]);
    });

    it('requests then approves an active one', () => {
      const after = loan();
      expect(steps(null, after)).toEqual([
        { kind: 'requested', loan: { ...after, status: 'PendingApproval' } },
        { kind: 'approved', loan: after },
      ]);
    });

    it('requests then rejects a rejected one', () => {
      const after = loan({ status: 'Rejected', rejectionReason: 'No' });
      expect(steps(null, after)).toEqual([
        { kind: 'requested', loan: { ...after, status: 'PendingApproval' } },
        { kind: 'rejected', loan: after },
      ]);
    });

    it('snaps to any other status', () => {
      const after = repaid();
      expect(steps(null, after)).toEqual([{ kind: 'snapLoan', loan: after }]);
    });

    it('treats another loan id as new', () => {
      const after = pending({ publicLoanId: 'l2' });
      expect(steps(repaid(), after)).toEqual([{ kind: 'requested', loan: after }]);
    });
  });

  describe('the same loan', () => {
    it('approves and rejects a pending loan', () => {
      const approved = loan();
      const rejected = loan({ status: 'Rejected' });
      expect(steps(pending(), approved)).toEqual([{ kind: 'approved', loan: approved }]);
      expect(steps(pending(), rejected)).toEqual([{ kind: 'rejected', loan: rejected }]);
    });

    it('gives the player a collection of an unmatured Active loan', () => {
      const after = collecting();
      expect(steps(loan(), after)).toEqual([
        { kind: 'collecting', by: 'player', paid: null, loan: after },
      ]);
    });

    it('gives the keeper a collection of a matured Active loan', () => {
      const after = collecting({ dueOn: '2026-11-23T11:59:00Z' });
      expect(steps(matured(), after)).toEqual([
        { kind: 'collecting', by: 'keeper', paid: null, loan: after },
      ]);
    });

    it('gives the player a matured collection that was asked for', () => {
      const after = collecting({ dueOn: '2026-11-23T11:59:00Z' });
      expect(steps(matured(), after, true)).toEqual([
        { kind: 'collecting', by: 'player', paid: null, loan: after },
      ]);
    });

    it('gives the retry an Overdue collection, and the player when asked', () => {
      const after = collecting({ dueOn: '2026-11-23T11:59:00Z' });
      expect(steps(overdue(), after)).toEqual([
        { kind: 'collecting', by: 'retry', paid: null, loan: after },
      ]);
      expect(steps(overdue(), after, true)).toEqual([
        { kind: 'collecting', by: 'player', paid: null, loan: after },
      ]);
    });

    it('repays a pending collection with the growth of amountRepaid', () => {
      const after = repaid();
      expect(steps(collecting(), after)).toEqual([{ kind: 'repaid', collected: 220, loan: after }]);
    });

    it('shows a partial collection, and snaps when nothing was collected', () => {
      const partial = loan({ amountRepaid: 120, outstanding: 100 });
      expect(steps(collecting(), partial)).toEqual([
        { kind: 'partial', collected: 120, loan: partial },
      ]);
      const aborted = loan();
      expect(steps(collecting(), aborted)).toEqual([{ kind: 'snapLoan', loan: aborted }]);
    });

    it('marks the first overdue only when overdueSince was null before', () => {
      const after = overdue();
      expect(steps(collecting(), after)).toEqual([{ kind: 'overdue', first: true, loan: after }]);
      const again = steps(collecting({ overdueSince: '2026-11-23T11:50:00Z' }), after);
      expect(again).toEqual([{ kind: 'overdue', first: false, loan: after }]);
    });

    it('plays the collection before an Active loan turns Overdue', () => {
      const after = overdue();
      expect(steps(matured(), after)).toEqual([
        {
          kind: 'collecting',
          by: 'keeper',
          paid: false,
          loan: { ...matured(), status: 'CollectionPending' },
        },
        { kind: 'overdue', first: true, loan: after },
      ]);
    });

    it('plays the collection before an Active loan turns Repaid', () => {
      const after = repaid();
      expect(steps(loan(), after)).toEqual([
        {
          kind: 'collecting',
          by: 'player',
          paid: true,
          loan: { ...loan(), status: 'CollectionPending' },
        },
        { kind: 'repaid', collected: 220, loan: after },
      ]);
    });

    it('plays the retry before an Overdue loan turns Repaid', () => {
      const after = repaid({ amountRepaid: 264 });
      expect(steps(overdue(), after)).toEqual([
        {
          kind: 'collecting',
          by: 'retry',
          paid: true,
          loan: { ...overdue(), status: 'CollectionPending' },
        },
        { kind: 'repaid', collected: 264, loan: after },
      ]);
    });

    it('plays a collection then a partial for Active to Active with growth', () => {
      const after = loan({ amountRepaid: 120, outstanding: 100 });
      expect(steps(loan(), after)).toEqual([
        {
          kind: 'collecting',
          by: 'player',
          paid: true,
          loan: { ...loan(), status: 'CollectionPending' },
        },
        { kind: 'partial', collected: 120, loan: after },
      ]);
    });

    it('plays a collection then a repeat overdue for Overdue to Overdue with growth', () => {
      const after = overdue({ amountRepaid: 100, outstanding: 164 });
      expect(steps(overdue(), after)).toEqual([
        {
          kind: 'collecting',
          by: 'retry',
          paid: true,
          loan: { ...overdue(), status: 'CollectionPending' },
        },
        { kind: 'overdue', first: false, loan: after },
      ]);
    });

    it('gives nothing for an unchanged Active or Overdue loan', () => {
      expect(steps(loan(), loan())).toEqual([]);
      expect(steps(overdue(), overdue())).toEqual([]);
    });

    it.each([
      ['CollectionPending', collecting()],
      ['Repaid', repaid()],
      ['Rejected', loan({ status: 'Rejected' })],
      ['PendingApproval', pending()],
    ])('gives nothing for an unchanged %s loan', (_name, same) => {
      expect(steps(same, same)).toEqual([]);
    });

    it('snaps to a pair no story explains', () => {
      const after = loan();
      expect(steps(repaid(), after)).toEqual([{ kind: 'snapLoan', loan: after }]);
    });
  });
});

describe('newestLoan', () => {
  it('reads the first loan or null', () => {
    const a = loan({ publicLoanId: 'a' });
    const b = loan({ publicLoanId: 'b' });
    expect(newestLoan([])).toBeNull();
    expect(newestLoan([a, b])).toBe(a);
  });
});

const row = (amount: number, sentOn: string, from = 'me', to = 'you'): WireRow => ({
  senderUserId: from,
  recipientUserId: to,
  amount,
  sentOn,
});

describe('slipsOf', () => {
  it('maps the first five rows with out from me', () => {
    const rows = [
      row(1, 't6'),
      row(2, 't5', 'you', 'me'),
      row(3, 't4'),
      row(4, 't3'),
      row(5, 't2'),
      row(6, 't1'),
    ];
    expect(slipsOf(rows, 'me')).toEqual([
      { out: true, amount: 1 },
      { out: false, amount: 2 },
      { out: true, amount: 3 },
      { out: true, amount: 4 },
      { out: true, amount: 5 },
    ]);
  });
});

describe('wireSteps', () => {
  const base = [row(10, 't1')];

  it('gives nothing without a new row', () => {
    expect(wireSteps(base, [...base], 'me')).toEqual([]);
  });

  it('gives a wireOut with the slips from the new row on', () => {
    const after = [row(50, 't2'), ...base];
    expect(wireSteps(base, after, 'me')).toEqual([
      {
        kind: 'wireOut',
        amount: 50,
        slips: [
          { out: true, amount: 50 },
          { out: true, amount: 10 },
        ],
      },
    ]);
  });

  it('gives a wireIn for a row sent by someone else', () => {
    const after = [row(75, 't2', 'you', 'me'), ...base];
    expect(wireSteps(base, after, 'me')).toEqual([
      {
        kind: 'wireIn',
        amount: 75,
        slips: [
          { out: false, amount: 75 },
          { out: true, amount: 10 },
        ],
      },
    ]);
  });

  it('plays the two newest of three new rows, older first, the third only in the slips', () => {
    const after = [row(30, 't4'), row(20, 't3'), row(40, 't2'), ...base];
    expect(MAX_WIRES).toBe(2);
    expect(wireSteps(base, after, 'me')).toEqual([
      {
        kind: 'wireOut',
        amount: 20,
        slips: [
          { out: true, amount: 20 },
          { out: true, amount: 40 },
          { out: true, amount: 10 },
        ],
      },
      {
        kind: 'wireOut',
        amount: 30,
        slips: [
          { out: true, amount: 30 },
          { out: true, amount: 20 },
          { out: true, amount: 40 },
          { out: true, amount: 10 },
        ],
      },
    ]);
  });
});

describe('STAGED_KINDS', () => {
  it('holds exactly the outcome kinds', () => {
    expect([...STAGED_KINDS].sort()).toEqual(
      ['approved', 'overdue', 'partial', 'rejected', 'repaid', 'wireIn', 'wireOut'].sort(),
    );
  });
});

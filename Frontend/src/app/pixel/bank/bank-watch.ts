export interface BankLoan {
  readonly publicLoanId: string;
  readonly principal: number;
  readonly totalDue: number;
  readonly penalty: number;
  readonly amountRepaid: number;
  readonly outstanding: number;
  readonly status: string;
  readonly dueOn: string | null;
  readonly overdueSince: string | null;
  readonly rejectionReason: string | null;
}
export interface BankOffer {
  readonly name: string;
  readonly principal: number;
  readonly totalDue: number;
  readonly term: string;
  readonly requiredTurnover: number;
}
export interface BankWallet {
  readonly availableFunds: number;
  readonly lifetimeTurnover: number;
}
export interface WireRow {
  readonly senderUserId: string;
  readonly recipientUserId: string;
  readonly amount: number;
  readonly sentOn: string;
}
export interface WireSlip {
  readonly out: boolean;
  readonly amount: number;
}
export interface BankShown {
  readonly loan: BankLoan | null;
  readonly known: boolean;
  readonly slips: readonly WireSlip[];
}
export type DueFormat = (endsOn: string, now: number) => string;
export type Collector = 'player' | 'keeper' | 'retry';
export type BankStep =
  | { readonly kind: 'snapLoan'; readonly loan: BankLoan | null }
  | { readonly kind: 'snapSlips'; readonly slips: readonly WireSlip[] }
  | { readonly kind: 'requested' | 'approved' | 'rejected'; readonly loan: BankLoan }
  | {
      readonly kind: 'collecting';
      readonly by: Collector;
      readonly paid: boolean | null;
      readonly loan: BankLoan;
    }
  | { readonly kind: 'partial' | 'repaid'; readonly collected: number; readonly loan: BankLoan }
  | { readonly kind: 'overdue'; readonly first: boolean; readonly loan: BankLoan }
  | {
      readonly kind: 'wireOut' | 'wireIn';
      readonly amount: number;
      readonly slips: readonly WireSlip[];
    };

export const STAGED_KINDS: ReadonlySet<BankStep['kind']> = new Set([
  'approved',
  'rejected',
  'partial',
  'repaid',
  'overdue',
  'wireOut',
  'wireIn',
]);
export const MAX_WIRES = 2;
const SLIP_ROWS = 5;

export function newestLoan(loans: readonly BankLoan[]): BankLoan | null {
  return loans[0] ?? null;
}

export function slipsOf(rows: readonly WireRow[], me: string): readonly WireSlip[] {
  return rows.slice(0, SLIP_ROWS).map((r) => ({ out: r.senderUserId === me, amount: r.amount }));
}

function collectorOf(before: BankLoan, asked: boolean, now: number): Collector {
  if (asked) return 'player';
  if (before.status === 'Active' && before.dueOn !== null && Date.parse(before.dueOn) > now) {
    return 'player';
  }
  if (before.status === 'Overdue') return 'retry';
  return 'keeper';
}

function newLoanSteps(after: BankLoan): readonly BankStep[] {
  if (after.status === 'PendingApproval') return [{ kind: 'requested', loan: after }];
  const pending = { ...after, status: 'PendingApproval' };
  if (after.status === 'Active') {
    return [
      { kind: 'requested', loan: pending },
      { kind: 'approved', loan: after },
    ];
  }
  if (after.status === 'Rejected') {
    return [
      { kind: 'requested', loan: pending },
      { kind: 'rejected', loan: after },
    ];
  }
  return [{ kind: 'snapLoan', loan: after }];
}

function pendingSteps(after: BankLoan): readonly BankStep[] {
  if (after.status === 'Active') return [{ kind: 'approved', loan: after }];
  if (after.status === 'Rejected') return [{ kind: 'rejected', loan: after }];
  if (after.status === 'PendingApproval') return [];
  return [{ kind: 'snapLoan', loan: after }];
}

function collectionSteps(before: BankLoan, after: BankLoan): readonly BankStep[] {
  const collected = after.amountRepaid - before.amountRepaid;
  if (after.status === 'Repaid') return [{ kind: 'repaid', collected, loan: after }];
  if (after.status === 'Active') {
    if (collected > 0) return [{ kind: 'partial', collected, loan: after }];
    return [{ kind: 'snapLoan', loan: after }];
  }
  if (after.status === 'Overdue') {
    const first = before.overdueSince === null && after.overdueSince !== null;
    return [{ kind: 'overdue', first, loan: after }];
  }
  if (after.status === 'CollectionPending') return [];
  return [{ kind: 'snapLoan', loan: after }];
}

function openLoanSteps(
  before: BankLoan,
  after: BankLoan,
  asked: boolean,
  now: number,
): readonly BankStep[] {
  const by = collectorOf(before, asked, now);
  if (after.status === 'CollectionPending') {
    return [{ kind: 'collecting', by, paid: null, loan: after }];
  }
  const collected = after.amountRepaid - before.amountRepaid;
  const col = { ...before, status: 'CollectionPending' };
  const collecting: BankStep = { kind: 'collecting', by, paid: collected > 0, loan: col };
  if (after.status === 'Repaid') return [collecting, { kind: 'repaid', collected, loan: after }];
  if (before.status === 'Active' && after.status === 'Overdue') {
    const first = before.overdueSince === null && after.overdueSince !== null;
    return [collecting, { kind: 'overdue', first, loan: after }];
  }
  if (before.status === 'Active' && after.status === 'Active') {
    if (collected > 0) return [collecting, { kind: 'partial', collected, loan: after }];
    return [];
  }
  if (before.status === 'Overdue' && after.status === 'Overdue') {
    if (collected > 0) return [collecting, { kind: 'overdue', first: false, loan: after }];
    return [];
  }
  return [{ kind: 'snapLoan', loan: after }];
}

function sameLoanSteps(
  before: BankLoan,
  after: BankLoan,
  asked: boolean,
  now: number,
): readonly BankStep[] {
  if (before.status === 'PendingApproval') return pendingSteps(after);
  if (before.status === 'CollectionPending') return collectionSteps(before, after);
  if (before.status === 'Active' || before.status === 'Overdue') {
    return openLoanSteps(before, after, asked, now);
  }
  if (before.status === after.status) return [];
  return [{ kind: 'snapLoan', loan: after }];
}

export function loanSteps(
  before: BankLoan | null,
  after: BankLoan | null,
  asked: boolean,
  now: number,
): readonly BankStep[] {
  if (after === null) return [];
  if (before === null || before.publicLoanId !== after.publicLoanId) return newLoanSteps(after);
  return sameLoanSteps(before, after, asked, now);
}

function wireKey(row: WireRow): string {
  return `${row.sentOn}|${row.senderUserId}|${row.recipientUserId}|${row.amount}`;
}

export function wireSteps(
  before: readonly WireRow[],
  after: readonly WireRow[],
  me: string,
): readonly BankStep[] {
  const known = new Set(before.map(wireKey));
  const fresh: number[] = [];
  after.forEach((row, i) => {
    if (!known.has(wireKey(row))) fresh.push(i);
  });
  return fresh
    .slice(0, MAX_WIRES)
    .reverse()
    .map((i): BankStep => {
      const kind = after[i].senderUserId === me ? 'wireOut' : 'wireIn';
      return { kind, amount: after[i].amount, slips: slipsOf(after.slice(i), me) };
    });
}

import { fmt } from '../casino/room';
import type { BankLoan, BankOffer, DueFormat, WireSlip } from './bank-watch';

export const BOARD_FEE = 'LATE FEE 20%';

export interface BoardRow {
  readonly cells: readonly string[];
  readonly locked: boolean;
  readonly tag: string | null;
}

const BOARD_ROWS = 3;
const money = (n: number): string => '$' + fmt(n);

function dueRow(loan: BankLoan, now: number, format: DueFormat | null): string {
  if (format === null || loan.dueOn === null) return '';
  return format(loan.dueOn, now).toUpperCase().replace('…', '...');
}

function loanRows(loan: BankLoan, now: number, format: DueFormat | null): readonly string[] {
  const owed = 'OWED ' + money(loan.outstanding);
  if (loan.status === 'PendingApproval') return ['IN REVIEW', 'LOAN ' + money(loan.principal), ''];
  if (loan.status === 'Active') return ['DUE IN', dueRow(loan, now, format), owed];
  if (loan.status === 'CollectionPending') return ['COLLECTING', '', owed];
  if (loan.status === 'Overdue') return ['OVERDUE', 'FEE ' + money(loan.penalty), owed];
  if (loan.status === 'Repaid') return ['PAID IN FULL', 'PAID ' + money(loan.amountRepaid), owed];
  if (loan.status === 'Rejected') return ['DENIED', 'NEXT!', ''];
  return ['', '', ''];
}

export function ledRows(
  loan: BankLoan | null,
  known: boolean,
  now: number,
  format: DueFormat | null,
): readonly string[] {
  if (!known) return ['', 'NEXT!', ''];
  if (loan === null) return ['NO LOAN', 'NEXT!', ''];
  return loanRows(loan, now, format);
}

export function termLabel(term: string): string {
  const m = /^(?:(\d+)\.)?(\d{2}):(\d{2}):(\d{2})$/.exec(term);
  if (m === null || Number(m[4]) !== 0) return term;
  const minutes = Number(m[1] ?? 0) * 1440 + Number(m[2]) * 60 + Number(m[3]);
  return minutes + ' MIN';
}

export function boardRows(
  offers: readonly BankOffer[],
  turnover: number | null,
): readonly BoardRow[] {
  return offers.slice(0, BOARD_ROWS).map((o) => {
    const locked = turnover !== null && turnover < o.requiredTurnover;
    return {
      cells: [o.name.toUpperCase(), money(o.principal), money(o.totalDue), termLabel(o.term)],
      locked,
      tag: locked ? fmt(o.requiredTurnover) + '+' : null,
    };
  });
}

export function boardLine(row: BoardRow): string {
  if (row.tag === null) return row.cells.join(' ');
  return [...row.cells, row.tag].join(' ');
}

function neonName(name: string): string {
  if (name === 'Standard') return 'STD';
  return name.toUpperCase();
}

export function neonLines(offers: readonly BankOffer[]): readonly string[] {
  return offers.slice(0, BOARD_ROWS).map((o) => neonName(o.name) + ' ' + money(o.principal));
}

export function slipLabel(slip: WireSlip): string {
  return (slip.out ? '-' : '+') + fmt(slip.amount);
}

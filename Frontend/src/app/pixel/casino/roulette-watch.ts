// The roulette scene's input types and the two pure helpers that turn bets into felt zones.
export interface FeltBet {
  readonly type: string;
  readonly selection: number | null;
  readonly stake: number;
}
export interface SpinBet extends FeltBet {
  readonly payout: number;
}
export interface SpinView {
  readonly publicSpinId: string;
  readonly pocket: number;
  readonly totalStake: number;
  readonly totalPayout: number;
  readonly bets: readonly SpinBet[];
}
export interface ToteSpin {
  readonly pocket: number;
}
export interface FeltStack {
  readonly zone: string;
  readonly stake: number;
  readonly count: number;
}

const NAMED: ReadonlyMap<string, string> = new Map([
  ['Red', 'red'],
  ['Black', 'black'],
  ['Odd', 'odd'],
  ['Even', 'even'],
  ['Low', 'low'],
  ['High', 'high'],
]);

const inRange = (n: number | null, lo: number, hi: number): n is number =>
  n !== null && Number.isInteger(n) && n >= lo && n <= hi;

export function zoneOf(bet: FeltBet): string | null {
  const sel = bet.selection;
  if (bet.type === 'Straight') return inRange(sel, 0, 36) ? 'n' + sel : null;
  if (bet.type === 'Dozen') return inRange(sel, 1, 3) ? 'dozen' + sel : null;
  if (bet.type === 'Column') return inRange(sel, 1, 3) ? 'col' + sel : null;
  return NAMED.get(bet.type) ?? null;
}

export function feltStacks(bets: readonly FeltBet[]): readonly FeltStack[] {
  const byZone = new Map<string, { stake: number; count: number }>();
  for (const b of bets) {
    const zone = zoneOf(b);
    if (zone === null) continue;
    const cur = byZone.get(zone) ?? { stake: 0, count: 0 };
    byZone.set(zone, { stake: cur.stake + b.stake, count: cur.count + 1 });
  }
  return [...byZone].map(([zone, v]) => ({ zone, stake: v.stake, count: v.count }));
}

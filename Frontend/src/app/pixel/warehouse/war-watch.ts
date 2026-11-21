export interface WarSnap {
  readonly status: string;
  readonly isLeader: boolean;
  readonly currentPrice: number;
  readonly players: number;
}

export type WarMove =
  { kind: 'raise'; by: 'you' | 'rival'; delta: number } | { kind: 'settle'; won: boolean } | null;

export function warPhase(status: string, isLeader: boolean): 'open' | 'bidding' | 'won' | 'lost' {
  if (status === 'Bidding') return 'bidding';
  if (status === 'Settled') return isLeader ? 'won' : 'lost';
  return 'open';
}

export function warLeader(snap: WarSnap): 'you' | 'rival' | null {
  if (snap.isLeader) return 'you';
  return snap.currentPrice > 0 ? 'rival' : null;
}

function isSettlement(before: WarSnap, after: WarSnap): boolean {
  return before.status !== 'Settled' && after.status === 'Settled';
}

function isRaise(before: WarSnap, after: WarSnap): boolean {
  return (
    before.status === 'Bidding' &&
    after.status === 'Bidding' &&
    after.currentPrice > before.currentPrice
  );
}

export function warMove(before: WarSnap | null, after: WarSnap): WarMove {
  if (before === null) return null;
  if (isSettlement(before, after)) return { kind: 'settle', won: after.isLeader };
  if (isRaise(before, after)) {
    return {
      kind: 'raise',
      by: warLeader(after) ?? 'rival',
      delta: after.currentPrice - before.currentPrice,
    };
  }
  return null;
}

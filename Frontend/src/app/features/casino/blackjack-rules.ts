import { ActiveBlackjackHand, BlackjackLimits } from '../../core/api/models';
import { HandView, fromActive } from './hand-view';

export const HAND_TIMEOUT_MS = 300_000;

const CARD_RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'] as const;
const CARD_SUITS = ['♣', '♦', '♥', '♠'] as const;

export function cardLabel(code: number): string {
  return CARD_RANKS[code % 13] + CARD_SUITS[Math.floor(code / 13)];
}

export function canDouble(hand: HandView, balance: number): boolean {
  return (
    hand.status === 'InProgress' &&
    hand.playerCards.length === 2 &&
    !hand.doubled &&
    balance >= hand.stake
  );
}

export function dealProblem(
  stake: number,
  limits: BlackjackLimits,
  balance: number,
): string | null {
  if (!Number.isInteger(stake)) return 'Stake must be a whole number of chips';
  if (stake < limits.minBet || stake > limits.maxBet) {
    return `Stake must be between ${limits.minBet} and ${limits.maxBet}`;
  }
  if (stake > balance) return 'Not enough chips on account';
  return null;
}

export function reconcileHand(
  local: HandView | null,
  active: ActiveBlackjackHand | null,
): HandView | null {
  if (active !== null) {
    if (local === null || local.publicHandId !== active.publicHandId) {
      return fromActive(active);
    }
    return local;
  }
  if (local !== null && local.status === 'InProgress') {
    return null;
  }
  return local;
}

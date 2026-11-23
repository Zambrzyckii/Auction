// Turns the hand the server reports into the steps the blackjack room plays. The server
// deals and pays. Nothing here computes a total or a payout.
export interface TableHand {
  readonly publicHandId: string;
  readonly status: string;
  readonly stake: number;
  readonly doubled: boolean;
  readonly playerCards: readonly number[];
  readonly playerTotal: number;
  readonly playerIsSoft: boolean;
  readonly dealerCards: readonly number[];
  readonly dealerHidden: boolean;
  readonly dealerTotal: number | null;
  readonly outcome: string | null;
  readonly payout: number | null;
  readonly autoStood: boolean;
  readonly autoStandOn: string | null;
}
export interface ShownHand {
  readonly id: string;
  readonly player: number;
  readonly dealer: number;
  readonly hole: boolean;
  readonly stake: number;
  readonly settled: boolean;
}
export type BjStep =
  | { readonly kind: 'sweep' }
  | { readonly kind: 'stake'; readonly amount: number }
  | { readonly kind: 'card'; readonly row: 'player' | 'dealer'; readonly code: number }
  | { readonly kind: 'hole' }
  | { readonly kind: 'reveal'; readonly code: number }
  | {
      readonly kind: 'settle';
      readonly outcome: string;
      readonly payout: number;
      readonly stake: number;
      readonly bust: boolean;
      readonly autoStood: boolean;
    };

type Row = 'player' | 'dealer';

const cardsOf = (row: Row, codes: readonly number[]): BjStep[] =>
  codes.map((code) => ({ kind: 'card', row, code }));

export function shownOf(hand: TableHand): ShownHand {
  return {
    id: hand.publicHandId,
    player: hand.playerCards.length,
    dealer: hand.dealerHidden ? 2 : hand.dealerCards.length,
    hole: hand.dealerHidden,
    stake: hand.stake,
    settled: hand.status === 'Completed',
  };
}

function withoutTarget(shown: ShownHand | null): readonly BjStep[] {
  if (shown?.settled) return [{ kind: 'sweep' }];
  return [];
}

function freshDeal(shown: ShownHand | null, target: TableHand): readonly BjStep[] {
  const sweep: BjStep[] = shown ? [{ kind: 'sweep' }] : [];
  return [
    ...sweep,
    { kind: 'stake', amount: target.stake },
    ...cardsOf('player', target.playerCards.slice(0, 1)),
    ...cardsOf('dealer', target.dealerCards.slice(0, 1)),
    ...cardsOf('player', target.playerCards.slice(1, 2)),
    { kind: 'hole' },
    ...cardsOf('player', target.playerCards.slice(2)),
    ...revealedPart(target, true),
    ...settleOf(target, false),
  ];
}

function sameHand(shown: ShownHand, target: TableHand): readonly BjStep[] {
  const raise: BjStep[] =
    target.stake > shown.stake ? [{ kind: 'stake', amount: target.stake }] : [];
  return [
    ...raise,
    ...cardsOf('player', target.playerCards.slice(shown.player)),
    ...revealedPart(target, shown.hole),
    ...settleOf(target, shown.settled),
  ];
}

function revealedPart(target: TableHand, holeDown: boolean): BjStep[] {
  if (target.dealerHidden || !holeDown) return [];
  return [
    { kind: 'reveal', code: target.dealerCards[1] },
    ...cardsOf('dealer', target.dealerCards.slice(2)),
  ];
}

function settleOf(target: TableHand, alreadySettled: boolean): BjStep[] {
  if (target.status !== 'Completed' || alreadySettled) return [];
  const outcome = target.outcome ?? 'Lose';
  return [
    {
      kind: 'settle',
      outcome,
      payout: target.payout ?? 0,
      stake: target.stake,
      bust: outcome === 'Lose' && target.playerTotal > 21,
      autoStood: target.autoStood,
    },
  ];
}

export function bjSteps(shown: ShownHand | null, target: TableHand | null): readonly BjStep[] {
  if (!target) return withoutTarget(shown);
  if (!shown || shown.id !== target.publicHandId) return freshDeal(shown, target);
  return sameHand(shown, target);
}

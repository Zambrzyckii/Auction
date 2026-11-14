import {
  ActiveBlackjackHand,
  BlackjackHand,
  BlackjackHandHistory,
  BlackjackOutcome,
} from '../../core/api/models';

export interface HandView {
  readonly publicHandId: string;
  readonly status: 'InProgress' | 'Completed';
  readonly stake: number;
  readonly doubled: boolean;
  readonly playerCards: readonly number[];
  readonly playerTotal: number;
  readonly playerIsSoft: boolean;
  readonly dealerCards: readonly number[];
  readonly dealerHidden: boolean;
  readonly dealerTotal: number | null;
  readonly outcome: BlackjackOutcome | null;
  readonly payout: number | null;
  readonly autoStood: boolean;
  readonly lastActionOn: number;
}

export function fromActive(dto: ActiveBlackjackHand): HandView {
  return {
    publicHandId: dto.publicHandId,
    status: 'InProgress',
    stake: dto.stake,
    doubled: dto.doubled,
    playerCards: dto.playerCards,
    playerTotal: dto.playerTotal,
    playerIsSoft: dto.playerIsSoft,
    dealerCards: dto.visibleDealerCards,
    dealerHidden: true,
    dealerTotal: null,
    outcome: null,
    payout: null,
    autoStood: false,
    lastActionOn: Date.parse(dto.lastActionOn),
  };
}

export function fromHand(dto: BlackjackHand, receivedAt: number): HandView {
  return {
    publicHandId: dto.publicHandId,
    status: dto.status,
    stake: dto.stake,
    doubled: dto.doubled,
    playerCards: dto.playerCards,
    playerTotal: dto.playerTotal,
    playerIsSoft: dto.playerIsSoft,
    dealerCards: dto.visibleDealerCards,
    dealerHidden: dto.status === 'InProgress',
    dealerTotal: dto.dealerTotal,
    outcome: dto.outcome,
    payout: dto.payout,
    autoStood: dto.autoStood,
    lastActionOn: receivedAt,
  };
}

export function fromHistory(dto: BlackjackHandHistory): HandView {
  return {
    publicHandId: dto.publicHandId,
    status: 'Completed',
    stake: dto.stake,
    doubled: dto.doubled,
    playerCards: dto.playerCards,
    playerTotal: dto.playerTotal,
    playerIsSoft: false,
    dealerCards: dto.dealerCards,
    dealerHidden: false,
    dealerTotal: dto.dealerTotal,
    outcome: dto.outcome,
    payout: dto.payout,
    autoStood: dto.autoStood,
    lastActionOn: Date.parse(dto.completedOn ?? dto.startedOn),
  };
}

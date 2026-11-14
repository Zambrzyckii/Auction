import { Wallet, WarehouseDetails } from '../../core/api/models';
import {
  WAREHOUSE_TIERS,
  canLeave,
  entryRejected,
  joinBlockReason,
  raiseBlockReason,
  warehousePollMs,
} from './warehouse-rules';

function war(overrides: Partial<WarehouseDetails>): WarehouseDetails {
  return {
    publicWarehouseId: 'war-1',
    tier: 'Small',
    status: 'Open',
    estimateMin: 400,
    estimateMax: 900,
    entryFee: 500,
    currentPrice: 0,
    itemCount: 4,
    players: 0,
    maxPlayers: 5,
    biddingStartsOn: null,
    biddingEndsOn: null,
    isParticipant: false,
    participantState: null,
    isLeader: false,
    cancellationReason: null,
    manifest: null,
    ...overrides,
  };
}

function wallet(overrides: Partial<Wallet>): Wallet {
  return { availableFunds: 1000, lockedFunds: 0, lifetimeTurnover: 0, ...overrides };
}

const NOW = Date.parse('2026-11-14T12:00:00Z');

describe('WAREHOUSE_TIERS', () => {
  it('keeps each tier entry fee next to its increments', () => {
    expect(WAREHOUSE_TIERS.get('Small')).toEqual({ entryFee: 500, increments: [10, 50, 100] });
    expect(WAREHOUSE_TIERS.get('Large')?.increments).toEqual([100, 250, 500, 1000]);
    expect(WAREHOUSE_TIERS.has('Haunted')).toBe(false);
  });
});

describe('joinBlockReason', () => {
  it('allows a join into an open lobby with the fee covered', () => {
    expect(joinBlockReason(war({}), wallet({}), NOW)).toBeNull();
    const counting = war({ players: 3, biddingStartsOn: new Date(NOW + 20_000).toISOString() });
    expect(joinBlockReason(counting, wallet({}), NOW)).toBeNull();
  });

  it('mirrors the server refusals in the server order', () => {
    expect(joinBlockReason(war({ status: 'Bidding' }), wallet({}), NOW)).toBe(
      'Warehouse war is not open, current status: Bidding',
    );
    const finished = war({ biddingStartsOn: new Date(NOW - 1).toISOString() });
    expect(joinBlockReason(finished, wallet({}), NOW)).toBe(
      'Bidding countdown has already finished',
    );
    expect(joinBlockReason(war({ isParticipant: true }), wallet({}), NOW)).toBe(
      'User already joined this warehouse war',
    );
    expect(joinBlockReason(war({ players: 5 }), wallet({}), NOW)).toBe(
      'Warehouse war lobby is full',
    );
    expect(joinBlockReason(war({}), wallet({ availableFunds: 499 }), NOW)).toBe(
      'Not enough funds on account',
    );
  });
});

describe('canLeave', () => {
  it('lets a participant leave only an open war before the countdown ends', () => {
    expect(canLeave(war({ isParticipant: true }), NOW)).toBe(true);
    expect(canLeave(war({}), NOW)).toBe(false);
    expect(canLeave(war({ isParticipant: true, status: 'Bidding' }), NOW)).toBe(false);
    const finished = war({
      isParticipant: true,
      biddingStartsOn: new Date(NOW - 1).toISOString(),
    });
    expect(canLeave(finished, NOW)).toBe(false);
  });
});

describe('entryRejected', () => {
  it('flags a join that the wallet silently refused', () => {
    expect(entryRejected(NOW - 5000, war({}))).toBe(true);
  });

  it('stays quiet without a join, after a confirmation and outside Open', () => {
    expect(entryRejected(null, war({}))).toBe(false);
    expect(entryRejected(NOW - 5000, war({ isParticipant: true }))).toBe(false);
    expect(entryRejected(NOW - 5000, war({ status: 'Settled' }))).toBe(false);
  });
});

describe('raiseBlockReason', () => {
  function bidding(overrides: Partial<WarehouseDetails>): WarehouseDetails {
    return war({
      status: 'Bidding',
      isParticipant: true,
      participantState: 'Active',
      currentPrice: 100,
      biddingEndsOn: new Date(NOW + 8000).toISOString(),
      ...overrides,
    });
  }

  it('allows a raise inside the window and the budget', () => {
    expect(raiseBlockReason(bidding({}), 10, NOW)).toBeNull();
    expect(raiseBlockReason(bidding({ currentPrice: 400 }), 100, NOW)).toBeNull();
  });

  it('mirrors the server refusals in the server order', () => {
    expect(raiseBlockReason(war({}), 10, NOW)).toBe(
      'Warehouse war is not in bidding, current status: Open',
    );
    const closed = bidding({ biddingEndsOn: new Date(NOW - 1).toISOString() });
    expect(raiseBlockReason(closed, 10, NOW)).toBe('Raise window has already closed');
    expect(
      raiseBlockReason(bidding({ isParticipant: false, participantState: null }), 10, NOW),
    ).toBe('User is not a participant of this warehouse war');
    expect(raiseBlockReason(bidding({ participantState: 'PendingLock' }), 10, NOW)).toBe(
      'Entry fee is not confirmed yet',
    );
    expect(raiseBlockReason(bidding({ isLeader: true }), 10, NOW)).toBe(
      'Current leader cannot raise own bid',
    );
    expect(raiseBlockReason(bidding({}), 7, NOW)).toBe('Increment is not allowed for this tier');
    expect(raiseBlockReason(bidding({ currentPrice: 450 }), 100, NOW)).toBe(
      'Raise would exceed the entry fee budget',
    );
  });
});

describe('warehousePollMs', () => {
  it('polls every second during the bidding', () => {
    expect(warehousePollMs(war({ status: 'Bidding' }))).toBe(1000);
  });

  it('polls every 2.5 seconds otherwise', () => {
    expect(warehousePollMs(null)).toBe(2500);
    expect(warehousePollMs(war({}))).toBe(2500);
    expect(warehousePollMs(war({ status: 'Open', biddingStartsOn: '2026-11-14T12:00:00Z' }))).toBe(
      2500,
    );
    expect(warehousePollMs(war({ status: 'Settled' }))).toBe(2500);
  });
});

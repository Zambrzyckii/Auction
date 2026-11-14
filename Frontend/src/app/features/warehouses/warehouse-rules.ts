import { Wallet, WarehouseDetails, WarehouseSummary } from '../../core/api/models';

export function joinBlockReason(war: WarehouseDetails, wallet: Wallet, now: number): string | null {
  if (war.status !== 'Open') {
    return `Warehouse war is not open, current status: ${war.status}`;
  }
  if (war.biddingStartsOn !== null && Date.parse(war.biddingStartsOn) <= now) {
    return 'Bidding countdown has already finished';
  }
  if (war.isParticipant) {
    return 'User already joined this warehouse war';
  }
  if (war.players >= war.maxPlayers) {
    return 'Warehouse war lobby is full';
  }
  if (wallet.availableFunds < war.entryFee) {
    return 'Not enough funds on account';
  }
  return null;
}

export function canLeave(war: WarehouseDetails, now: number): boolean {
  return (
    war.isParticipant &&
    war.status === 'Open' &&
    (war.biddingStartsOn === null || Date.parse(war.biddingStartsOn) > now)
  );
}

export function entryRejected(joinedAt: number | null, war: WarehouseDetails): boolean {
  return joinedAt !== null && war.status === 'Open' && !war.isParticipant;
}

export function raiseBlockReason(
  war: WarehouseDetails,
  increment: number,
  now: number,
): string | null {
  if (war.status !== 'Bidding') {
    return `Warehouse war is not in bidding, current status: ${war.status}`;
  }
  if (war.biddingEndsOn !== null && Date.parse(war.biddingEndsOn) < now) {
    return 'Raise window has already closed';
  }
  if (!war.isParticipant) {
    return 'User is not a participant of this warehouse war';
  }
  if (war.participantState !== 'Active') {
    return 'Entry fee is not confirmed yet';
  }
  if (war.isLeader) {
    return 'Current leader cannot raise own bid';
  }
  if (!war.increments.includes(increment)) {
    return 'Increment is not allowed for this tier';
  }
  if (war.currentPrice + increment > war.entryFee) {
    return 'Raise would exceed the entry fee budget';
  }
  return null;
}

export function warehousePollMs(war: Pick<WarehouseSummary, 'status'> | null): number {
  return war !== null && war.status === 'Bidding' ? 1000 : 2500;
}

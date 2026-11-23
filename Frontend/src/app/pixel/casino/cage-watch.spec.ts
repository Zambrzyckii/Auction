import { cageMove, cageSnap } from './cage-watch';
import type { CagePurchase, CageSnap } from './cage-watch';

const purchase = (status: string, id = 'p1', amount = 500): CagePurchase => ({
  publicPurchaseId: id,
  amount,
  status,
});
const snap = (over: Partial<CageSnap> = {}): CageSnap => ({
  chips: 1000,
  cashedOut: 100,
  purchase: null,
  ...over,
});

describe('cageMove', () => {
  it('never animates the first poll', () => {
    expect(cageMove(null, snap({ purchase: purchase('Pending') }))).toBeNull();
  });

  it('starts a pending move for a new pending purchase', () => {
    expect(cageMove(snap(), snap({ purchase: purchase('Pending') }))).toEqual({
      kind: 'pending',
      amount: 500,
    });
  });

  it.each([
    ['Completed', 'bought'],
    ['Rejected', 'rejected'],
    ['Expired', 'expired'],
  ])('maps Pending to %s as %s', (status, kind) => {
    const before = snap({ purchase: purchase('Pending') });
    expect(cageMove(before, snap({ purchase: purchase(status) }))).toEqual({
      kind,
      amount: 500,
    });
  });

  it('treats a new purchase first seen as Completed as bought', () => {
    const before = snap({ purchase: purchase('Completed', 'old') });
    expect(cageMove(before, snap({ purchase: purchase('Completed', 'new', 250) }))).toEqual({
      kind: 'bought',
      amount: 250,
    });
    expect(cageMove(snap(), snap({ purchase: purchase('Completed') }))).toEqual({
      kind: 'bought',
      amount: 500,
    });
  });

  it('gives null for an unknown status', () => {
    expect(cageMove(snap(), snap({ purchase: purchase('Refunded') }))).toBeNull();
  });

  it('gives null for the same id and status', () => {
    const same = snap({ purchase: purchase('Pending') });
    expect(cageMove(same, snap({ purchase: purchase('Pending') }))).toBeNull();
  });

  it('detects a cash-out from lifetimeCashedOut growing', () => {
    expect(cageMove(snap(), snap({ cashedOut: 450 }))).toEqual({ kind: 'cashout', amount: 350 });
  });

  it('ignores a balance drop with cashedOut unchanged', () => {
    expect(cageMove(snap(), snap({ chips: 400 }))).toBeNull();
  });

  it('prefers the purchase move over a cash-out in the same step', () => {
    const before = snap({ purchase: purchase('Pending') });
    const after = snap({ cashedOut: 450, purchase: purchase('Completed') });
    expect(cageMove(before, after)).toEqual({ kind: 'bought', amount: 500 });
  });
});

describe('cageSnap', () => {
  it('maps balance, lifetimeCashedOut and latestPurchase', () => {
    const latest = purchase('Pending');
    expect(cageSnap({ balance: 12.5, lifetimeCashedOut: 7, latestPurchase: latest })).toEqual({
      chips: 12.5,
      cashedOut: 7,
      purchase: latest,
    });
  });
});

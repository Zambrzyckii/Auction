// Turns two polls of the casino account into the one move the cage plays, if any.
export interface CagePurchase {
  readonly publicPurchaseId: string;
  readonly amount: number;
  readonly status: string;
}
export interface CageCasino {
  readonly balance: number;
  readonly lifetimeCashedOut: number;
  readonly latestPurchase: CagePurchase | null;
}
export interface CageSnap {
  readonly chips: number;
  readonly cashedOut: number;
  readonly purchase: CagePurchase | null;
}
export type CageMove = {
  readonly kind: 'pending' | 'bought' | 'rejected' | 'expired' | 'cashout';
  readonly amount: number;
} | null;

export function cageSnap(casino: CageCasino): CageSnap {
  return {
    chips: casino.balance,
    cashedOut: casino.lifetimeCashedOut,
    purchase: casino.latestPurchase,
  };
}

const changedPurchase = (
  before: CagePurchase | null,
  after: CagePurchase | null,
): CagePurchase | null => {
  if (!after) return null;
  if (!before) return after;
  if (before.publicPurchaseId !== after.publicPurchaseId) return after;
  if (before.status !== after.status) return after;
  return null;
};

const purchaseKind = (status: string): 'pending' | 'bought' | 'rejected' | 'expired' | null => {
  if (status === 'Pending') return 'pending';
  if (status === 'Completed') return 'bought';
  if (status === 'Rejected') return 'rejected';
  if (status === 'Expired') return 'expired';
  return null;
};

const purchaseMove = (purchase: CagePurchase): CageMove => {
  const kind = purchaseKind(purchase.status);
  if (!kind) return null;
  return { kind, amount: purchase.amount };
};

const cashoutMove = (before: CageSnap, after: CageSnap): CageMove => {
  if (after.cashedOut <= before.cashedOut) return null;
  return { kind: 'cashout', amount: after.cashedOut - before.cashedOut };
};

export function cageMove(before: CageSnap | null, after: CageSnap): CageMove {
  if (!before) return null;
  const purchase = changedPurchase(before.purchase, after.purchase);
  if (purchase) return purchaseMove(purchase);
  return cashoutMove(before, after);
}

export type AuctionStatus = 'Pending' | 'Active' | 'Closed' | 'Cancelled';
export type ItemRarity = 'Common' | 'Rare' | 'Epic' | 'Legendary';
export type ItemStatus = 'Available' | 'LockedForAuction' | 'SoldToShop' | 'Consumed';

export interface Auction {
  readonly publicAuctionId: string;
  readonly sellerUserId: string;
  readonly currentWinningUserId: string | null;
  readonly status: AuctionStatus;
  readonly currentPrice: number;
  readonly endsOn: string;
  readonly itemName: string | null;
  readonly itemRarity: ItemRarity | null;
  readonly itemOfficialPrice: number | null;
  readonly cancellationReason: string | null;
}

export interface AuctionBid {
  readonly bidderUserId: string;
  readonly amount: number;
  readonly placedOn: string;
}

export interface InventoryItem {
  readonly publicItemId: string;
  readonly name: string;
  readonly rarity: ItemRarity;
  readonly status: ItemStatus;
  readonly officialPrice: number;
}

export interface Wallet {
  readonly availableFunds: number;
  readonly lockedFunds: number;
  readonly lifetimeTurnover: number;
}

export interface LoginResponse {
  readonly token: string;
}

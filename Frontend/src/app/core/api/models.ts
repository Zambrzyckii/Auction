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

export type SocialPlatform =
  | 'Twitch'
  | 'YouTube'
  | 'X'
  | 'Instagram'
  | 'GitHub'
  | 'Steam'
  | 'Discord'
  | 'Website';

export interface FriendSummary {
  readonly userId: string;
  readonly username: string;
}

export interface SocialLink {
  readonly platform: SocialPlatform;
  readonly url: string;
}

export interface Profile {
  readonly userId: string;
  readonly username: string;
  readonly isPrivate: boolean;
  readonly level: number | null;
  readonly memberSince: string | null;
  readonly avatarUrl: string | null;
  readonly friends: readonly FriendSummary[];
  readonly socialLinks: readonly SocialLink[];
}

export interface FriendRequest {
  readonly publicFriendshipId: string;
  readonly userId: string;
  readonly username: string;
}

export interface OwnProfile {
  readonly userId: string;
  readonly username: string;
  readonly isPrivate: boolean;
  readonly level: number;
  readonly memberSince: string;
  readonly avatarUrl: string | null;
  readonly friends: readonly FriendSummary[];
  readonly incomingFriendRequests: readonly FriendRequest[];
  readonly outgoingFriendRequests: readonly FriendRequest[];
  readonly socialLinks: readonly SocialLink[];
}

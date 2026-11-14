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

export type FriendshipStatus = 'Pending' | 'Accepted';

export interface Transfer {
  readonly senderUserId: string;
  readonly recipientUserId: string;
  readonly amount: number;
  readonly sentOn: string;
}

export type LoanStatus =
  | 'PendingApproval'
  | 'Active'
  | 'CollectionPending'
  | 'Overdue'
  | 'Repaid'
  | 'Rejected';

export interface LoanOffer {
  readonly name: string;
  readonly principal: number;
  readonly interestRate: number;
  readonly totalDue: number;
  readonly term: string;
  readonly requiredTurnover: number;
}

export interface Loan {
  readonly publicLoanId: string;
  readonly offerName: string;
  readonly principal: number;
  readonly interestRate: number;
  readonly totalDue: number;
  readonly penalty: number;
  readonly amountRepaid: number;
  readonly outstanding: number;
  readonly status: LoanStatus;
  readonly requestedOn: string;
  readonly dueOn: string | null;
  readonly overdueSince: string | null;
  readonly repaidOn: string | null;
  readonly rejectionReason: string | null;
}

export interface FriendRequestResult {
  readonly publicFriendshipId: string;
  readonly status: FriendshipStatus;
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

export type ChipPurchaseStatus = 'Pending' | 'Completed' | 'Rejected' | 'Expired';

export interface ChipPurchase {
  readonly publicPurchaseId: string;
  readonly amount: number;
  readonly status: ChipPurchaseStatus;
  readonly requestedOn: string;
  readonly resolvedOn: string | null;
  readonly rejectionReason: string | null;
}

export interface RouletteLimits {
  readonly minBet: number;
  readonly maxBet: number;
  readonly maxBetsPerSpin: number;
}

export interface Casino {
  readonly balance: number;
  readonly lifetimeBought: number;
  readonly lifetimeCashedOut: number;
  readonly latestPurchase: ChipPurchase | null;
  readonly activeBlackjackHand: ActiveBlackjackHand | null;
  readonly roulette: RouletteLimits;
  readonly blackjack: BlackjackLimits;
}

export type RouletteBetType =
  | 'Straight'
  | 'Red'
  | 'Black'
  | 'Odd'
  | 'Even'
  | 'Low'
  | 'High'
  | 'Dozen'
  | 'Column';

export interface RouletteBet {
  readonly type: RouletteBetType;
  readonly selection: number | null;
  readonly stake: number;
}

export interface RouletteBetResult extends RouletteBet {
  readonly payout: number;
}

export interface RouletteSpin {
  readonly publicSpinId: string;
  readonly pocket: number;
  readonly color: 'Green' | 'Red' | 'Black';
  readonly totalStake: number;
  readonly totalPayout: number;
  readonly placedOn: string;
  readonly bets: readonly RouletteBetResult[];
}

export interface RouletteSpinResult extends RouletteSpin {
  readonly balance: number;
}

export type BlackjackOutcome = 'Win' | 'Lose' | 'Push' | 'Blackjack';

export interface BlackjackLimits {
  readonly minBet: number;
  readonly maxBet: number;
}

export interface ActiveBlackjackHand {
  readonly publicHandId: string;
  readonly stake: number;
  readonly doubled: boolean;
  readonly playerCards: readonly number[];
  readonly playerTotal: number;
  readonly playerIsSoft: boolean;
  readonly visibleDealerCards: readonly number[];
  readonly startedOn: string;
  readonly lastActionOn: string;
}

export interface BlackjackHand {
  readonly publicHandId: string;
  readonly status: 'InProgress' | 'Completed';
  readonly stake: number;
  readonly doubled: boolean;
  readonly playerCards: readonly number[];
  readonly playerTotal: number;
  readonly playerIsSoft: boolean;
  readonly visibleDealerCards: readonly number[];
  readonly dealerTotal: number | null;
  readonly outcome: BlackjackOutcome | null;
  readonly payout: number | null;
  readonly autoStood: boolean;
  readonly balance: number;
  readonly startedOn: string;
  readonly completedOn: string | null;
}

export interface BlackjackHandHistory {
  readonly publicHandId: string;
  readonly stake: number;
  readonly doubled: boolean;
  readonly outcome: BlackjackOutcome | null;
  readonly payout: number | null;
  readonly playerCards: readonly number[];
  readonly dealerCards: readonly number[];
  readonly playerTotal: number;
  readonly dealerTotal: number;
  readonly autoStood: boolean;
  readonly startedOn: string;
  readonly completedOn: string | null;
}

export type PawnshopRarity = 'Common' | 'Rare' | 'Epic' | 'Legendary';

export type ShopStatus = 'PendingPayment' | 'Active' | 'Rejected';

export type StockItemStatus = 'InStock' | 'Withdrawn' | 'Sold';

export interface BotTier {
  readonly name: string;
  readonly rarity: PawnshopRarity;
  readonly price: number;
  readonly spawnInterval: string;
  readonly payoutRate: number;
}

export interface PawnshopOffers {
  readonly premisesPrice: number;
  readonly premisesRequiredTurnover: number;
  readonly stockSellDelay: string;
  readonly botTiers: readonly BotTier[];
}

export interface StockItem {
  readonly publicStockItemId: string;
  readonly name: string;
  readonly rarity: PawnshopRarity;
  readonly price: number;
  readonly payoutRate: number;
  readonly status: StockItemStatus;
  readonly spawnedOn: string;
  readonly sellAfter: string;
  readonly resolvedOn: string | null;
  readonly payoutAmount: number | null;
}

export interface Pawnshop {
  readonly publicPawnshopId: string;
  readonly status: ShopStatus;
  readonly requestedOn: string;
  readonly activatedOn: string | null;
  readonly rejectionReason: string | null;
  readonly botTierName: string | null;
  readonly botRarity: PawnshopRarity | null;
  readonly botSpawnInterval: string | null;
  readonly botPayoutRate: number | null;
  readonly botPurchasedOn: string | null;
  readonly nextSpawnOn: string | null;
  readonly pendingBotTierName: string | null;
  readonly stock: readonly StockItem[];
}

export type WarehouseWarStatus = 'Stocking' | 'Open' | 'Bidding' | 'Settled' | 'Cancelled';

export type ParticipantState = 'PendingLock' | 'Active';

export interface WarehouseSummary {
  readonly publicWarehouseId: string;
  readonly tier: string;
  readonly status: WarehouseWarStatus;
  readonly estimateMin: number;
  readonly estimateMax: number;
  readonly entryFee: number;
  readonly currentPrice: number;
  readonly itemCount: number;
  readonly players: number;
  readonly maxPlayers: number;
  readonly biddingStartsOn: string | null;
  readonly biddingEndsOn: string | null;
}

export interface ManifestItem {
  readonly name: string;
  readonly rarity: string;
  readonly price: number;
}

export interface WarehouseDetails extends WarehouseSummary {
  readonly isParticipant: boolean;
  readonly participantState: ParticipantState | null;
  readonly isLeader: boolean;
  readonly cancellationReason: string | null;
  readonly manifest: readonly ManifestItem[] | null;
}

export interface WarehouseInvite {
  readonly publicWarehouseId: string;
  readonly inviterUserId: string;
  readonly inviterUsername: string;
  readonly createdOn: string;
}

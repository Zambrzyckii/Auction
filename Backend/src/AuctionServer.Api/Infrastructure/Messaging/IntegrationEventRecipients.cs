using AuctionServer.Shared.Infrastructure.Delivery;
using AuctionServer.Shared.Integration.Events.Auctions;
using AuctionServer.Shared.Integration.Events.Banking;
using AuctionServer.Shared.Integration.Events.Casino;
using AuctionServer.Shared.Integration.Events.Funds;
using AuctionServer.Shared.Integration.Events.Items;
using AuctionServer.Shared.Integration.Events.Pawnshop;
using AuctionServer.Shared.Integration.Events.Players;
using AuctionServer.Shared.Integration.Events.Users;
using AuctionServer.Shared.Integration.Events.Warehouses;
using Auctions = AuctionServer.Modules.Auctions.Application.Handlers;
using Banking = AuctionServer.Modules.Banking.Application.Handlers;
using Casino = AuctionServer.Modules.Casino.Application.Handlers;
using Inventory = AuctionServer.Modules.Inventory.Application.Handlers;
using Pawnshop = AuctionServer.Modules.Pawnshop.Application.Handlers;
using Profiles = AuctionServer.Modules.Profiles.Application.Handlers;
using Wallets = AuctionServer.Modules.Wallets.Application.Handlers;
using Warehouses = AuctionServer.Modules.Warehouses.Application.Handlers;

namespace AuctionServer.Api.Infrastructure.Messaging;

public static class IntegrationEventRecipients
{
    public static DeliveryRecipientRegistry Build() => new(
        new Dictionary<string, IReadOnlyList<DeliveryRecipient>>
        {
            [nameof(UserRegisteredEvent)] =
            [
                DeliveryRecipient.Of<UserRegisteredEvent, Wallets.UserRegisteredEventHandler>("Wallets"),
                DeliveryRecipient.Of<UserRegisteredEvent, Inventory.UserRegisteredEventHandler>("Inventory"),
                DeliveryRecipient.Of<UserRegisteredEvent, Profiles.UserRegisteredEventHandler>("Profiles")
            ],
            [nameof(BidPlacedEvent)] =
                [DeliveryRecipient.Of<BidPlacedEvent, Wallets.BidPlacedEventHandler>("Wallets")],
            [nameof(AuctionFinishedEvent)] =
            [
                DeliveryRecipient.Of<AuctionFinishedEvent, Wallets.AuctionFinishedEventHandler>("Wallets"),
                DeliveryRecipient.Of<AuctionFinishedEvent, Inventory.AuctionFinishedEventHandler>("Inventory")
            ],
            [nameof(ItemSoldToShopEvent)] =
                [DeliveryRecipient.Of<ItemSoldToShopEvent, Wallets.ItemSoldToShopEventHandler>("Wallets")],
            [nameof(ItemLockRequestedEvent)] =
                [DeliveryRecipient.Of<ItemLockRequestedEvent, Inventory.ItemLockRequestedEventHandler>("Inventory")],
            [nameof(ItemLockedEvent)] =
                [DeliveryRecipient.Of<ItemLockedEvent, Auctions.ItemLockedEventHandler>("Auctions")],
            [nameof(ItemLockRejectedEvent)] =
                [DeliveryRecipient.Of<ItemLockRejectedEvent, Auctions.ItemLockRejectedEventHandler>("Auctions")],
            [nameof(AuctionActivatedEvent)] = [],
            [nameof(AuctionSettledEvent)] =
                [DeliveryRecipient.Of<AuctionSettledEvent, Inventory.AuctionSettledEventHandler>("Inventory")],
            [nameof(AuctionCancelledEvent)] =
                [DeliveryRecipient.Of<AuctionCancelledEvent, Inventory.AuctionCancelledEventHandler>("Inventory")],
            [nameof(FundsLockedEvent)] =
                [DeliveryRecipient.Of<FundsLockedEvent, Auctions.FundsLockedEventHandler>("Auctions")],
            [nameof(FundsLockRejectedEvent)] =
                [DeliveryRecipient.Of<FundsLockRejectedEvent, Auctions.FundsLockRejectedEventHandler>("Auctions")],
            [nameof(FundsLockRequestedEvent)] =
                [DeliveryRecipient.Of<FundsLockRequestedEvent, Wallets.FundsLockRequestedEventHandler>("Wallets")],
            [nameof(FundsUnlockRequestedEvent)] =
                [DeliveryRecipient.Of<FundsUnlockRequestedEvent, Wallets.FundsUnlockRequestedEventHandler>("Wallets")],
            [nameof(WarehouseStockRequestedEvent)] =
                [DeliveryRecipient.Of<WarehouseStockRequestedEvent, Inventory.WarehouseStockRequestedEventHandler>("Inventory")],
            [nameof(WarehouseStockedEvent)] =
                [DeliveryRecipient.Of<WarehouseStockedEvent, Warehouses.WarehouseStockedEventHandler>("Warehouses")],
            [nameof(WarehouseEntryLockRequestedEvent)] =
                [DeliveryRecipient.Of<WarehouseEntryLockRequestedEvent, Wallets.WarehouseEntryLockRequestedEventHandler>("Wallets")],
            [nameof(WarehouseEntryLockedEvent)] =
                [DeliveryRecipient.Of<WarehouseEntryLockedEvent, Warehouses.WarehouseEntryLockedEventHandler>("Warehouses")],
            [nameof(WarehouseEntryLockRejectedEvent)] =
                [DeliveryRecipient.Of<WarehouseEntryLockRejectedEvent, Warehouses.WarehouseEntryLockRejectedEventHandler>("Warehouses")],
            [nameof(WarehouseWonEvent)] =
                [DeliveryRecipient.Of<WarehouseWonEvent, Wallets.WarehouseWonEventHandler>("Wallets")],
            [nameof(WarehouseSettledEvent)] =
                [DeliveryRecipient.Of<WarehouseSettledEvent, Inventory.WarehouseSettledEventHandler>("Inventory")],
            [nameof(LoanRequestedEvent)] =
                [DeliveryRecipient.Of<LoanRequestedEvent, Wallets.LoanRequestedEventHandler>("Wallets")],
            [nameof(LoanApprovedEvent)] =
                [DeliveryRecipient.Of<LoanApprovedEvent, Banking.LoanApprovedEventHandler>("Banking")],
            [nameof(LoanRejectedEvent)] =
                [DeliveryRecipient.Of<LoanRejectedEvent, Banking.LoanRejectedEventHandler>("Banking")],
            [nameof(LoanRepaymentRequestedEvent)] =
                [DeliveryRecipient.Of<LoanRepaymentRequestedEvent, Wallets.LoanRepaymentRequestedEventHandler>("Wallets")],
            [nameof(LoanRepaymentCollectedEvent)] =
                [DeliveryRecipient.Of<LoanRepaymentCollectedEvent, Banking.LoanRepaymentCollectedEventHandler>("Banking")],
            [nameof(PawnshopPaymentRequestedEvent)] =
                [DeliveryRecipient.Of<PawnshopPaymentRequestedEvent, Wallets.PawnshopPaymentRequestedEventHandler>("Wallets")],
            [nameof(PawnshopPaymentCompletedEvent)] =
                [DeliveryRecipient.Of<PawnshopPaymentCompletedEvent, Pawnshop.PawnshopPaymentCompletedEventHandler>("Pawnshop")],
            [nameof(PawnshopPaymentRejectedEvent)] =
                [DeliveryRecipient.Of<PawnshopPaymentRejectedEvent, Pawnshop.PawnshopPaymentRejectedEventHandler>("Pawnshop")],
            [nameof(PawnshopStockRequestedEvent)] =
                [DeliveryRecipient.Of<PawnshopStockRequestedEvent, Inventory.PawnshopStockRequestedEventHandler>("Inventory")],
            [nameof(PawnshopStockedEvent)] =
                [DeliveryRecipient.Of<PawnshopStockedEvent, Pawnshop.PawnshopStockedEventHandler>("Pawnshop")],
            [nameof(PawnshopPayoutEvent)] =
                [DeliveryRecipient.Of<PawnshopPayoutEvent, Wallets.PawnshopPayoutEventHandler>("Wallets")],
            [nameof(PawnshopItemWithdrawnEvent)] =
                [DeliveryRecipient.Of<PawnshopItemWithdrawnEvent, Inventory.PawnshopItemWithdrawnEventHandler>("Inventory")],
            [nameof(CasinoChipPurchaseRequestedEvent)] =
                [DeliveryRecipient.Of<CasinoChipPurchaseRequestedEvent, Wallets.CasinoChipPurchaseRequestedEventHandler>("Wallets")],
            [nameof(CasinoChipPurchaseCompletedEvent)] =
                [DeliveryRecipient.Of<CasinoChipPurchaseCompletedEvent, Casino.CasinoChipPurchaseCompletedEventHandler>("Casino")],
            [nameof(CasinoChipPurchaseRejectedEvent)] =
                [DeliveryRecipient.Of<CasinoChipPurchaseRejectedEvent, Casino.CasinoChipPurchaseRejectedEventHandler>("Casino")],
            [nameof(CasinoCashOutEvent)] =
                [DeliveryRecipient.Of<CasinoCashOutEvent, Wallets.CasinoCashOutEventHandler>("Wallets")],
            [nameof(PlayerLevelledUpEvent)] =
                [DeliveryRecipient.Of<PlayerLevelledUpEvent, Profiles.PlayerLevelledUpEventHandler>("Profiles")]
        });
}

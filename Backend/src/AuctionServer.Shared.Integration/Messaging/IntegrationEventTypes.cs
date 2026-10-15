using System.Text.Json;
using AuctionServer.Shared.Integration.Events.Auctions;
using AuctionServer.Shared.Integration.Events.Banking;
using AuctionServer.Shared.Integration.Events.Funds;
using AuctionServer.Shared.Integration.Events.Items;
using AuctionServer.Shared.Integration.Events.Pawnshop;
using AuctionServer.Shared.Integration.Events.Users;
using AuctionServer.Shared.Integration.Events.Warehouses;
using MediatR;

namespace AuctionServer.Shared.Integration.Messaging;

public static class IntegrationEventTypes
{
    private static readonly IReadOnlyDictionary<string, Type> Registry = new Dictionary<string, Type>
    {
        [nameof(UserRegisteredEvent)] = typeof(UserRegisteredEvent),
        [nameof(BidPlacedEvent)] = typeof(BidPlacedEvent),
        [nameof(AuctionFinishedEvent)] = typeof(AuctionFinishedEvent),
        [nameof(ItemSoldToShopEvent)] = typeof(ItemSoldToShopEvent),
        [nameof(ItemLockRequestedEvent)] = typeof(ItemLockRequestedEvent),
        [nameof(ItemLockedEvent)] = typeof(ItemLockedEvent),
        [nameof(ItemLockRejectedEvent)] = typeof(ItemLockRejectedEvent),
        [nameof(AuctionActivatedEvent)] = typeof(AuctionActivatedEvent),
        [nameof(AuctionSettledEvent)] = typeof(AuctionSettledEvent),
        [nameof(AuctionCancelledEvent)] = typeof(AuctionCancelledEvent),
        [nameof(FundsLockedEvent)] = typeof(FundsLockedEvent),
        [nameof(FundsLockRejectedEvent)] = typeof(FundsLockRejectedEvent),
        [nameof(FundsLockRequestedEvent)] = typeof(FundsLockRequestedEvent),
        [nameof(FundsUnlockRequestedEvent)] = typeof(FundsUnlockRequestedEvent),
        [nameof(WarehouseStockRequestedEvent)] = typeof(WarehouseStockRequestedEvent),
        [nameof(WarehouseStockedEvent)] = typeof(WarehouseStockedEvent),
        [nameof(WarehouseEntryLockRequestedEvent)] = typeof(WarehouseEntryLockRequestedEvent),
        [nameof(WarehouseEntryLockedEvent)] = typeof(WarehouseEntryLockedEvent),
        [nameof(WarehouseEntryLockRejectedEvent)] = typeof(WarehouseEntryLockRejectedEvent),
        [nameof(WarehouseWonEvent)] = typeof(WarehouseWonEvent),
        [nameof(LoanRequestedEvent)] = typeof(LoanRequestedEvent),
        [nameof(LoanApprovedEvent)] = typeof(LoanApprovedEvent),
        [nameof(LoanRejectedEvent)] = typeof(LoanRejectedEvent),
        [nameof(LoanRepaymentRequestedEvent)] = typeof(LoanRepaymentRequestedEvent),
        [nameof(LoanRepaymentCollectedEvent)] = typeof(LoanRepaymentCollectedEvent),
        [nameof(PawnshopPaymentRequestedEvent)] = typeof(PawnshopPaymentRequestedEvent),
        [nameof(PawnshopPaymentCompletedEvent)] = typeof(PawnshopPaymentCompletedEvent),
        [nameof(PawnshopPaymentRejectedEvent)] = typeof(PawnshopPaymentRejectedEvent)
    };

    public static INotification Deserialize(string type, string content)
    {
        if (!Registry.TryGetValue(type, out var clrType))
            throw new NotSupportedException($"Unknown integration event type: {type}");

        return (INotification?)JsonSerializer.Deserialize(content, clrType)
               ?? throw new JsonException($"Empty payload for integration event {type}");
    }
}

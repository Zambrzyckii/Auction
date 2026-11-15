using AuctionServer.Shared.Integration.Events.Auctions;
using AuctionServer.Shared.Integration.Events.Banking;
using AuctionServer.Shared.Integration.Events.Casino;
using AuctionServer.Shared.Integration.Events.Funds;
using AuctionServer.Shared.Integration.Events.Pawnshop;
using AuctionServer.Shared.Integration.Events.Players;
using AuctionServer.Shared.Integration.Events.Warehouses;
using MediatR;

namespace AuctionServer.Api.Infrastructure.Push;

public sealed class PushRoutes(IReadOnlyDictionary<string, Action<INotification, PushConnections>> routes)
{
    public int Count => routes.Count;

    public bool Dispatch(INotification @event, PushConnections connections)
    {
        if (!routes.TryGetValue(@event.GetType().Name, out var route)) return false;

        route(@event, connections);
        return true;
    }

    public static PushRoutes Build() => new(new Dictionary<string, Action<INotification, PushConnections>>(
    [
        Route<AuctionActivatedEvent>((e, c) =>
        {
            c.Broadcast(PushMessage.AuctionChanged(e.PublicAuctionId));
            c.Broadcast(PushMessage.Of(PushTopics.AuctionListChanged));
        }),
        Route<AuctionFinishedEvent>((e, c) =>
        {
            c.Broadcast(PushMessage.AuctionChanged(e.PublicAuctionId));
            c.Broadcast(PushMessage.Of(PushTopics.AuctionListChanged));
        }),
        Route<BidPlacedEvent>((e, c) => c.Broadcast(PushMessage.AuctionChanged(e.PublicAuctionId))),
        Route<AuctionCancelledEvent>((e, c) => c.Broadcast(PushMessage.AuctionChanged(e.PublicAuctionId))),
        Route<AuctionSettledEvent>((e, c) =>
        {
            c.SendToUser(e.SellerUserId, PushMessage.Of(PushTopics.WalletChanged));
            c.SendToUser(e.WinnerUserId, PushMessage.Of(PushTopics.WalletChanged));
        }),
        Route<FundsLockedEvent>((e, c) => c.SendToUser(e.BidderUserId, PushMessage.Of(PushTopics.WalletChanged))),
        Route<WarehouseEntryLockedEvent>((e, c) => c.SendToUser(e.UserId, PushMessage.Of(PushTopics.WalletChanged))),
        Route<WarehouseSettledEvent>((e, c) => c.SendToUser(e.WinnerUserId, PushMessage.Of(PushTopics.WalletChanged))),
        Route<WarehouseWonEvent>((e, c) => c.Broadcast(PushMessage.WarehouseChanged(e.PublicWarehouseId))),
        Route<LoanApprovedEvent>((e, c) => c.SendToUser(e.UserId, PushMessage.Of(PushTopics.WalletChanged))),
        Route<LoanRepaymentCollectedEvent>((e, c) => c.SendToUser(e.UserId, PushMessage.Of(PushTopics.WalletChanged))),
        Route<LoanRepaymentRequestedEvent>((e, c) => c.SendToUser(e.UserId, PushMessage.Of(PushTopics.LoanChanged))),
        Route<CasinoChipPurchaseCompletedEvent>((e, c) => c.SendToUser(e.UserId, PushMessage.Of(PushTopics.WalletChanged))),
        Route<CasinoCashOutEvent>((e, c) => c.SendToUser(e.UserId, PushMessage.Of(PushTopics.CasinoChanged))),
        Route<PawnshopPaymentCompletedEvent>((e, c) => c.SendToUser(e.UserId, PushMessage.Of(PushTopics.WalletChanged))),
        Route<PawnshopPayoutEvent>((e, c) => c.SendToUser(e.UserId, PushMessage.Of(PushTopics.PawnshopChanged))),
        Route<PawnshopItemWithdrawnEvent>((e, c) => c.SendToUser(e.UserId, PushMessage.Of(PushTopics.PawnshopChanged))),
        Route<PlayerLevelledUpEvent>((e, c) => c.SendToUser(e.UserId, PushMessage.Of(PushTopics.WalletChanged)))
    ]));

    private static KeyValuePair<string, Action<INotification, PushConnections>> Route<TEvent>(
        Action<TEvent, PushConnections> handler) where TEvent : INotification =>
        new(typeof(TEvent).Name, (@event, connections) => handler((TEvent)@event, connections));
}

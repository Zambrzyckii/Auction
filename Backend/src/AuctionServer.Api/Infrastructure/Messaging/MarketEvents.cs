using AuctionServer.Shared.Integration.Events.Auctions;

namespace AuctionServer.Api.Infrastructure.Messaging;

public static class MarketEvents
{
    public static readonly IReadOnlySet<string> Published = new HashSet<string>
    {
        nameof(AuctionActivatedEvent),
        nameof(BidPlacedEvent),
        nameof(AuctionFinishedEvent),
        nameof(AuctionCancelledEvent)
    };
}

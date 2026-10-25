using System.Text.Json;
using AuctionServer.Modules.Auctions.Application.Interfaces.Persistence;
using AuctionServer.Modules.Auctions.Domain.Entities;
using AuctionServer.Modules.Auctions.Domain.Enums;
using AuctionServer.Modules.Auctions.Domain.Exceptions;
using AuctionServer.Modules.Auctions.Infrastructure.Inbox;
using AuctionServer.Modules.Auctions.Infrastructure.Outbox;
using AuctionServer.Shared.Integration.Events.Auctions;
using AuctionServer.Shared.Integration.Events.Funds;
using MediatR;

namespace AuctionServer.Modules.Auctions.Application.Handlers;

public sealed class FundsLockedEventHandler(IAuctionRepository repository) : INotificationHandler<FundsLockedEvent>
{
    public async Task Handle(FundsLockedEvent notification, CancellationToken cancellationToken)
    {
        if (await repository.WasEventProcessedAsync(notification.EventId, cancellationToken)) return;

        var auction = await repository.GetAuctionByIdAsync(notification.PublicAuctionId, cancellationToken);

        var eventId = Guid.NewGuid();
        OutboxMessage outboxMessage;

        if (auction.PendingBidRequestId != notification.RequestId)
            outboxMessage = RequestUnlock(eventId, auction.PublicAuctionId, notification.BidderUserId);
        else if (auction.Status == AuctionStatus.Active)
            outboxMessage = ConfirmBid(auction, eventId);
        else
            outboxMessage = RejectBidAndRequestUnlock(auction, eventId, notification.BidderUserId);

        var processedMessage = new ProcessedMessage { EventId = notification.EventId };
        try
        {
            await repository.SaveChangesWithInboxAndOutboxAsync(processedMessage, outboxMessage, CancellationToken.None);
        }
        catch (AuctionExceptions.EventAlreadyProcessedException)
        {
        }
    }

    private OutboxMessage ConfirmBid(Auction auction, Guid eventId)
    {
        var previousWinnerId = auction.CurrentWinningUserId;
        var previousPrice = previousWinnerId is null ? (decimal?)null : auction.CurrentPrice;

        auction.ConfirmPendingBid();

        repository.AddBid(new Bid
        {
            PublicAuctionId = auction.PublicAuctionId,
            BidderUserId = auction.CurrentWinningUserId!.Value,
            Amount = auction.CurrentPrice
        });

        return new OutboxMessage
        {
            Id = eventId,
            Type = nameof(BidPlacedEvent),
            Content = JsonSerializer.Serialize(new BidPlacedEvent(eventId, auction.PublicAuctionId,
                auction.CurrentWinningUserId!.Value, previousWinnerId, auction.CurrentPrice, previousPrice))
        };
    }

    private static OutboxMessage RejectBidAndRequestUnlock(Auction auction, Guid eventId, Guid bidderUserId)
    {
        auction.RejectPendingBid();
        return RequestUnlock(eventId, auction.PublicAuctionId, bidderUserId);
    }

    private static OutboxMessage RequestUnlock(Guid eventId, Guid publicAuctionId, Guid bidderUserId) =>
        new()
        {
            Id = eventId,
            Type = nameof(FundsUnlockRequestedEvent),
            Content = JsonSerializer.Serialize(new FundsUnlockRequestedEvent(eventId, publicAuctionId, bidderUserId))
        };
}

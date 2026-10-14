using System.Text.Json;
using AuctionServer.Modules.Auctions.Application.Interfaces.Persistence;
using AuctionServer.Modules.Auctions.Domain.Enums;
using AuctionServer.Modules.Auctions.Domain.Exceptions;
using AuctionServer.Modules.Auctions.Infrastructure.Inbox;
using AuctionServer.Modules.Auctions.Infrastructure.Outbox;
using AuctionServer.Shared.Integration.Events;
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

        if (auction.Status == AuctionStatus.Active)
        {
            var previousWinnerId = auction.CurrentWinningUserId;
            var previousPrice = previousWinnerId is null ? (decimal?)null : auction.CurrentPrice;

            auction.ConfirmPendingBid();

            outboxMessage = new OutboxMessage
            {
                Id = eventId,
                Type = nameof(BidPlacedEvent),
                Content = JsonSerializer.Serialize(new BidPlacedEvent(eventId, auction.PublicAuctionId,
                    auction.CurrentWinningUserId!.Value, previousWinnerId, auction.CurrentPrice, previousPrice))
            };
        }
        else
        {
            auction.RejectPendingBid();

            outboxMessage = new OutboxMessage
            {
                Id = eventId,
                Type = nameof(FundsUnlockRequestedEvent),
                Content = JsonSerializer.Serialize(new FundsUnlockRequestedEvent(eventId,
                    auction.PublicAuctionId, notification.BidderUserId))
            };
        }

        var processedMessage = new ProcessedMessage { EventId = notification.EventId };
        try
        {
            await repository.SaveChangesWithInboxAndOutboxAsync(processedMessage, outboxMessage, CancellationToken.None);
        }
        catch (AuctionExceptions.EventAlreadyProcessedException)
        {
        }
    }
}
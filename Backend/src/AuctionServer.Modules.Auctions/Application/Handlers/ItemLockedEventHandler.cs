using System.Text.Json;
using AuctionServer.Modules.Auctions.Application.Interfaces.Persistence;
using AuctionServer.Modules.Auctions.Domain.Exceptions;
using AuctionServer.Modules.Auctions.Infrastructure.Inbox;
using AuctionServer.Modules.Auctions.Infrastructure.Outbox;
using AuctionServer.Shared.Integration.Events;
using MediatR;

namespace AuctionServer.Modules.Auctions.Application.Handlers;

public sealed class ItemLockedEventHandler(IAuctionRepository repository) : INotificationHandler<ItemLockedEvent>
{
    public async Task Handle(ItemLockedEvent notification, CancellationToken cancellationToken)
    {
        if (await repository.WasEventProcessedAsync(notification.EventId, cancellationToken)) return;

        var auction = await repository.GetAuctionByIdAsync(notification.PublicAuctionId, cancellationToken);
        auction.Activate(notification.ItemName, notification.ItemRarity, notification.OfficialPrice);

        var eventId = Guid.NewGuid();
        var outboxMessage = new OutboxMessage
        {
            Id = eventId,
            Type = nameof(AuctionActivatedEvent),
            Content = JsonSerializer.Serialize(new AuctionActivatedEvent(eventId, auction.PublicAuctionId, auction.SellerUserId,
                auction.ItemId, notification.ItemName, notification.ItemRarity, notification.OfficialPrice, auction.CurrentPrice, auction.EndsOn))
        };

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

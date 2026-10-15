using AuctionServer.Modules.Inventory.Application.Interfaces;
using AuctionServer.Modules.Inventory.Domain.Exceptions;
using AuctionServer.Modules.Inventory.Infrastructure.Inbox;
using AuctionServer.Shared.Integration.Events.Auctions;
using MediatR;

namespace AuctionServer.Modules.Inventory.Application.Handlers;

public sealed class AuctionCancelledEventHandler(IItemRepository repository) : INotificationHandler<AuctionCancelledEvent>
{
    public async Task Handle(AuctionCancelledEvent notification, CancellationToken cancellationToken)
    {
        if (await repository.WasEventProcessedAsync(notification.EventId, cancellationToken)) return;

        var item = await repository.FindItemLockedForAuctionAsync(notification.PublicAuctionId, cancellationToken);
        item?.UnlockItem();

        var processedMessage = new ProcessedMessage { EventId = notification.EventId };

        try
        {
            await repository.SaveChangesWithInboxAsync(processedMessage, CancellationToken.None);
        }
        catch (InventoryException.EventAlreadyProcessedException)
        {
        }
    }
}
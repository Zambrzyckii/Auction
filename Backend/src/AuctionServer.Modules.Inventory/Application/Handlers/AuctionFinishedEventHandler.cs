using AuctionServer.Modules.Inventory.Application.Interfaces;
using AuctionServer.Modules.Inventory.Domain.Exceptions;
using AuctionServer.Modules.Inventory.Infrastructure.Inbox;
using AuctionServer.Shared.Integration.Events;
using MediatR;

namespace AuctionServer.Modules.Inventory.Application.Handlers;

public sealed class AuctionFinishedEventHandler(IItemRepository repository) : INotificationHandler<AuctionFinishedEvent>
{
    public async Task Handle(AuctionFinishedEvent notification, CancellationToken cancellationToken)
    {
        if (notification.WinnerUserId is not null) return;
        if (await repository.WasEventProcessedAsync(notification.EventId, cancellationToken)) return;

        var item = await repository.GetItemLockedForAuctionAsync(notification.PublicAuctionId, cancellationToken);
        item.UnlockItem();

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
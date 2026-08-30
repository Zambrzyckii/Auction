using AuctionServer.Modules.Inventory.Application.Interfaces;
using AuctionServer.Modules.Inventory.Domain.Exceptions;
using AuctionServer.Modules.Inventory.Infrastructure.Inbox;
using AuctionServer.Shared.Integration.Events;
using MediatR;

namespace AuctionServer.Modules.Inventory.Application.Handlers;

public sealed class AuctionSettledEventHandler(IItemRepository repository) : INotificationHandler<AuctionSettledEvent>
{
    public async Task Handle(AuctionSettledEvent notification, CancellationToken cancellationToken)
    {
        if (await repository.WasEventProcessedAsync(notification.EventId, cancellationToken)) return;

        var item = await repository.GetItemLockedForAuctionAsync(notification.PublicAuctionId, cancellationToken);
        item.TransferTo(notification.WinnerUserId);

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
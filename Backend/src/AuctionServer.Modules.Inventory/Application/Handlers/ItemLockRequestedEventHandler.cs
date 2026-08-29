using System.Text.Json;
using AuctionServer.Modules.Inventory.Application.Interfaces;
using AuctionServer.Modules.Inventory.Domain.Exceptions;
using AuctionServer.Modules.Inventory.Infrastructure.Inbox;
using AuctionServer.Modules.Inventory.Infrastructure.Outbox;
using AuctionServer.Shared.Integration.Events;
using MediatR;

namespace AuctionServer.Modules.Inventory.Application.Handlers;

public sealed class ItemLockRequestedEventHandler(IItemRepository repository) : INotificationHandler<ItemLockRequestedEvent>
{
    public async Task Handle(ItemLockRequestedEvent notification, CancellationToken cancellationToken)
    {
        if (await repository.WasEventProcessedAsync(notification.EventId, cancellationToken)) return;

        var replyId = Guid.NewGuid();
        OutboxMessage reply;

        try
        {
            var item = await repository.GetUserItemAsync(notification.SellerUserId, notification.PublicItemId, cancellationToken);
            item.LockForAuction(notification.PublicAuctionId);

            reply = new OutboxMessage
            {
                Id = replyId,
                Type = nameof(ItemLockedEvent),
                Content = JsonSerializer.Serialize(new ItemLockedEvent(
                    replyId, notification.PublicAuctionId, item.PublicItemId, item.Name, item.Rarity.ToString(), item.OfficialPrice))
            };
        }
        catch (Exception e) when (e is InventoryException.UserOrItemDoesntExistException or InventoryException.ItemNotAvailableException)
        {
            reply = new OutboxMessage
            {
                Id = replyId,
                Type = nameof(ItemLockRejectedEvent),
                Content = JsonSerializer.Serialize(new ItemLockRejectedEvent(
                    replyId, notification.PublicAuctionId, notification.PublicItemId, e.Message))
            };
        }

        var processedMessage = new ProcessedMessage { EventId = notification.EventId };

        try
        {
            await repository.SaveChangesWithInboxAndOutboxAsync(processedMessage, reply, CancellationToken.None);
        }
        catch (InventoryException.EventAlreadyProcessedException)
        {

        }
    }
}

using AuctionServer.Modules.Inventory.Application.Interfaces;
using AuctionServer.Modules.Inventory.Domain.Entities;
using AuctionServer.Modules.Inventory.Domain.Exceptions;
using AuctionServer.Modules.Inventory.Infrastructure.Inbox;
using AuctionServer.Shared.Integration.Events;
using MediatR;

namespace AuctionServer.Modules.Inventory.Application.Handlers;

public sealed class UserRegisteredEventHandler(IItemRepository repository, InventoryOptions options)
    : INotificationHandler<UserRegisteredEvent>
{
    public async Task Handle(UserRegisteredEvent notification, CancellationToken cancellationToken)
    {
        if (await repository.WasEventProcessedAsync(notification.EventId, cancellationToken)) return;

        List<Item> starterItems = [];
        foreach (var item in options.StarterItems)
        {
            var itemToAdd = Item.Create(notification.PublicUserId, item.Name, item.Rarity);
            starterItems.Add(itemToAdd);
        }
        var processedMessage = new ProcessedMessage { EventId = notification.EventId };

        try
        {
            await repository.AddItemsWithInboxAsync(starterItems, processedMessage, CancellationToken.None);
        }
        catch (InventoryException.EventAlreadyProcessedException)
        {

        }
    }
}

using AuctionServer.Modules.Inventory.Application.Interfaces;
using AuctionServer.Modules.Inventory.Application.Options;
using AuctionServer.Modules.Inventory.Domain.Entities;
using AuctionServer.Shared.Integration.Events.Users;
using MediatR;

namespace AuctionServer.Modules.Inventory.Application.Handlers;

public sealed class UserRegisteredEventHandler(IItemRepository repository, InventoryOptions options)
    : INotificationHandler<UserRegisteredEvent>
{
    public Task Handle(UserRegisteredEvent notification, CancellationToken cancellationToken)
    {
        return repository.ApplyOnceAsync(notification.EventId, () =>
        {
            List<Item> starterItems = [];
            foreach (var item in options.StarterItems)
            {
                var itemToAdd = Item.Create(notification.PublicUserId, item.Name, item.Rarity);
                starterItems.Add(itemToAdd);
            }

            repository.AddItems(starterItems);
            return Task.CompletedTask;
        }, cancellationToken);
    }
}

using AuctionServer.Modules.Inventory.Application.Interfaces;
using AuctionServer.Modules.Inventory.Domain.Entities;
using AuctionServer.Modules.Inventory.Domain.Enums;
using AuctionServer.Shared.Integration.Events.Warehouses;
using MediatR;

namespace AuctionServer.Modules.Inventory.Application.Handlers;

public sealed class WarehouseSettledEventHandler(IItemRepository repository) : INotificationHandler<WarehouseSettledEvent>
{
    public Task Handle(WarehouseSettledEvent notification, CancellationToken cancellationToken)
    {
        return repository.ApplyOnceAsync(notification.EventId, () =>
        {
            // The manifest carries the prices rolled at quote time; minting must not roll new ones.
            var wonItems = notification.Stock
                .Select(s => Item.CreateWithPrice(
                    notification.WinnerUserId, s.Name, Enum.Parse<ItemRarity>(s.Rarity), s.Price))
                .ToList();

            repository.AddItems(wonItems);
            return Task.CompletedTask;
        }, cancellationToken);
    }
}

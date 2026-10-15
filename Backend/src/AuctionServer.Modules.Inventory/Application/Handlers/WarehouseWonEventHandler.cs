using AuctionServer.Modules.Inventory.Application.Interfaces;
using AuctionServer.Modules.Inventory.Domain.Entities;
using AuctionServer.Modules.Inventory.Domain.Enums;
using AuctionServer.Modules.Inventory.Domain.Exceptions;
using AuctionServer.Modules.Inventory.Infrastructure.Inbox;
using AuctionServer.Shared.Integration.Events.Warehouses;
using MediatR;

namespace AuctionServer.Modules.Inventory.Application.Handlers;

public sealed class WarehouseWonEventHandler(IItemRepository repository) : INotificationHandler<WarehouseWonEvent>
{
    public async Task Handle(WarehouseWonEvent notification, CancellationToken cancellationToken)
    {
        if (await repository.WasEventProcessedAsync(notification.EventId, cancellationToken)) return;

        // The manifest carries the prices rolled at quote time; minting must not roll new ones.
        var wonItems = notification.Stock
            .Select(s => Item.CreateWithPrice(
                notification.WinnerUserId, s.Name, Enum.Parse<ItemRarity>(s.Rarity), s.Price))
            .ToList();
        var processedMessage = new ProcessedMessage { EventId = notification.EventId };

        try
        {
            await repository.AddItemsWithInboxAsync(wonItems, processedMessage, CancellationToken.None);
        }
        catch (InventoryException.EventAlreadyProcessedException)
        {
        }
    }
}

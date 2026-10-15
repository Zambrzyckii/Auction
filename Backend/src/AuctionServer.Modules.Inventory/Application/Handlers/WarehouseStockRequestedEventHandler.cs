using System.Text.Json;
using AuctionServer.Modules.Inventory.Application.Interfaces;
using AuctionServer.Modules.Inventory.Domain.Entities;
using AuctionServer.Modules.Inventory.Domain.Enums;
using AuctionServer.Modules.Inventory.Domain.Exceptions;
using AuctionServer.Modules.Inventory.Infrastructure.Inbox;
using AuctionServer.Modules.Inventory.Infrastructure.Outbox;
using AuctionServer.Shared.Integration.Events.Warehouses;
using MediatR;

namespace AuctionServer.Modules.Inventory.Application.Handlers;

public sealed class WarehouseStockRequestedEventHandler(IItemRepository repository)
    : INotificationHandler<WarehouseStockRequestedEvent>
{
    public async Task Handle(WarehouseStockRequestedEvent notification, CancellationToken cancellationToken)
    {
        if (await repository.WasEventProcessedAsync(notification.EventId, cancellationToken)) return;

        // The quote only borrows Item.Create for its hidden price roll; nothing is saved here.
        var stock = notification.Rarities.Select(rarityName =>
        {
            var rarity = Enum.Parse<ItemRarity>(rarityName);
            var rolled = Item.Create(Guid.Empty, $"Warehouse {rarity} Find", rarity);
            return new WarehouseStockItem(rolled.Name, rarity.ToString(), rolled.OfficialPrice);
        }).ToList();

        var replyId = Guid.NewGuid();
        var reply = new OutboxMessage
        {
            Id = replyId,
            Type = nameof(WarehouseStockedEvent),
            Content = JsonSerializer.Serialize(new WarehouseStockedEvent(replyId, notification.PublicWarehouseId, stock))
        };
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

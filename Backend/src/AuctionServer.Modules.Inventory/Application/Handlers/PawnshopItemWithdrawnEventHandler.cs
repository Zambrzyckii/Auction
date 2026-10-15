using AuctionServer.Modules.Inventory.Application.Interfaces;
using AuctionServer.Modules.Inventory.Domain.Entities;
using AuctionServer.Modules.Inventory.Domain.Enums;
using AuctionServer.Modules.Inventory.Domain.Exceptions;
using AuctionServer.Modules.Inventory.Infrastructure.Inbox;
using AuctionServer.Shared.Integration.Events.Pawnshop;
using MediatR;

namespace AuctionServer.Modules.Inventory.Application.Handlers;

public sealed class PawnshopItemWithdrawnEventHandler(IItemRepository repository)
    : INotificationHandler<PawnshopItemWithdrawnEvent>
{
    public async Task Handle(PawnshopItemWithdrawnEvent notification, CancellationToken cancellationToken)
    {
        if (await repository.WasEventProcessedAsync(notification.EventId, cancellationToken)) return;

        var item = Item.CreateWithPrice(
            notification.UserId, notification.Name, Enum.Parse<ItemRarity>(notification.Rarity), notification.Price);
        var processedMessage = new ProcessedMessage { EventId = notification.EventId };

        try
        {
            await repository.AddItemsWithInboxAsync([item], processedMessage, CancellationToken.None);
        }
        catch (InventoryException.EventAlreadyProcessedException)
        {
        }
    }
}

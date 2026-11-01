using System.Text.Json;
using AuctionServer.Modules.Inventory.Application.Interfaces;
using AuctionServer.Modules.Inventory.Domain.Entities;
using AuctionServer.Modules.Inventory.Domain.Enums;
using AuctionServer.Shared.Infrastructure.Outbox;
using AuctionServer.Shared.Integration.Events.Pawnshop;
using MediatR;

namespace AuctionServer.Modules.Inventory.Application.Handlers;

public sealed class PawnshopStockRequestedEventHandler(IItemRepository repository)
    : INotificationHandler<PawnshopStockRequestedEvent>
{
    public Task Handle(PawnshopStockRequestedEvent notification, CancellationToken cancellationToken)
    {
        return repository.ApplyOnceAsync(notification.EventId, () =>
        {
            // The quote only borrows Item.Create for its hidden price roll; nothing is saved here.
            var stock = notification.Rarities.Select(rarityName =>
            {
                var rarity = Enum.Parse<ItemRarity>(rarityName);
                var rolled = Item.Create(Guid.Empty, $"Pawned {rarity} Good", rarity);
                return new PawnshopStockItem(rolled.Name, rarity.ToString(), rolled.OfficialPrice);
            }).ToList();

            var replyId = Guid.NewGuid();
            return Task.FromResult<OutboxMessage?>(new OutboxMessage
            {
                Id = replyId,
                Type = nameof(PawnshopStockedEvent),
                Content = JsonSerializer.Serialize(new PawnshopStockedEvent(
                    replyId, notification.PublicPawnshopId, notification.EventId, stock))
            });
        }, cancellationToken);
    }
}

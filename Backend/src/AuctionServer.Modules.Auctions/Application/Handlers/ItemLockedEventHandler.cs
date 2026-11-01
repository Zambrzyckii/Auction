using System.Text.Json;
using AuctionServer.Modules.Auctions.Application.Interfaces.Persistence;
using AuctionServer.Shared.Infrastructure.Outbox;
using AuctionServer.Shared.Integration.Events.Auctions;
using AuctionServer.Shared.Integration.Events.Items;
using MediatR;

namespace AuctionServer.Modules.Auctions.Application.Handlers;

public sealed class ItemLockedEventHandler(IAuctionRepository repository) : INotificationHandler<ItemLockedEvent>
{
    public Task Handle(ItemLockedEvent notification, CancellationToken cancellationToken)
    {
        return repository.ApplyOnceAsync(notification.EventId, async () =>
        {
            var auction = await repository.GetAuctionByIdAsync(notification.PublicAuctionId, cancellationToken);
            auction.Activate(notification.ItemName, notification.ItemRarity, notification.OfficialPrice);

            var eventId = Guid.NewGuid();
            return (OutboxMessage?)new OutboxMessage
            {
                Id = eventId,
                Type = nameof(AuctionActivatedEvent),
                Content = JsonSerializer.Serialize(new AuctionActivatedEvent(eventId, auction.PublicAuctionId, auction.SellerUserId,
                    auction.ItemId, notification.ItemName, notification.ItemRarity, notification.OfficialPrice, auction.CurrentPrice, auction.EndsOn))
            };
        }, cancellationToken);
    }
}

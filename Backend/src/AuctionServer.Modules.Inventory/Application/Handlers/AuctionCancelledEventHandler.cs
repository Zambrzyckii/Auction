using AuctionServer.Modules.Inventory.Application.Interfaces;
using AuctionServer.Shared.Integration.Events.Auctions;
using MediatR;

namespace AuctionServer.Modules.Inventory.Application.Handlers;

public sealed class AuctionCancelledEventHandler(IItemRepository repository) : INotificationHandler<AuctionCancelledEvent>
{
    public Task Handle(AuctionCancelledEvent notification, CancellationToken cancellationToken)
    {
        return repository.ApplyOnceAsync(notification.EventId, async () =>
        {
            var item = await repository.FindItemLockedForAuctionAsync(notification.PublicAuctionId, cancellationToken);
            item?.UnlockItem();
        }, cancellationToken);
    }
}

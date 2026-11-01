using AuctionServer.Modules.Inventory.Application.Interfaces;
using AuctionServer.Shared.Integration.Events.Auctions;
using MediatR;

namespace AuctionServer.Modules.Inventory.Application.Handlers;

public sealed class AuctionFinishedEventHandler(IItemRepository repository) : INotificationHandler<AuctionFinishedEvent>
{
    public Task Handle(AuctionFinishedEvent notification, CancellationToken cancellationToken)
    {
        if (notification.WinnerUserId is not null) return Task.CompletedTask;

        return repository.ApplyOnceAsync(notification.EventId, async () =>
        {
            var item = await repository.GetItemLockedForAuctionAsync(notification.PublicAuctionId, cancellationToken);
            item.UnlockItem();
        }, cancellationToken);
    }
}

using AuctionServer.Modules.Inventory.Application.Interfaces;
using AuctionServer.Shared.Integration.Events.Auctions;
using MediatR;

namespace AuctionServer.Modules.Inventory.Application.Handlers;

public sealed class AuctionSettledEventHandler(IItemRepository repository) : INotificationHandler<AuctionSettledEvent>
{
    public Task Handle(AuctionSettledEvent notification, CancellationToken cancellationToken)
    {
        return repository.ApplyOnceAsync(notification.EventId, async () =>
        {
            var item = await repository.GetItemLockedForAuctionAsync(notification.PublicAuctionId, cancellationToken);
            item.TransferTo(notification.WinnerUserId);
        }, cancellationToken);
    }
}

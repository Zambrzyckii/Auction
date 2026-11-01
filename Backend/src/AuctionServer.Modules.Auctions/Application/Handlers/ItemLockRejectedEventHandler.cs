using AuctionServer.Modules.Auctions.Application.Interfaces.Persistence;
using AuctionServer.Shared.Integration.Events.Items;
using MediatR;

namespace AuctionServer.Modules.Auctions.Application.Handlers;

public sealed class ItemLockRejectedEventHandler(IAuctionRepository repository) : INotificationHandler<ItemLockRejectedEvent>
{
    public Task Handle(ItemLockRejectedEvent notification, CancellationToken cancellationToken)
    {
        return repository.ApplyOnceAsync(notification.EventId, async () =>
        {
            var auction = await repository.GetAuctionByIdAsync(notification.PublicAuctionId, cancellationToken);
            auction.Cancel(notification.Reason);
        }, cancellationToken);
    }
}

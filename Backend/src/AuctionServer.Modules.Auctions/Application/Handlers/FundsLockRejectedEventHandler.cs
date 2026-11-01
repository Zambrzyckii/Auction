using AuctionServer.Modules.Auctions.Application.Interfaces.Persistence;
using AuctionServer.Shared.Integration.Events.Funds;
using MediatR;

namespace AuctionServer.Modules.Auctions.Application.Handlers;

public sealed class FundsLockRejectedEventHandler(IAuctionRepository repository) : INotificationHandler<FundsLockRejectedEvent>
{
    public Task Handle(FundsLockRejectedEvent notification, CancellationToken cancellationToken)
    {
        return repository.ApplyOnceAsync(notification.EventId, async () =>
        {
            var auction = await repository.GetAuctionByIdAsync(notification.PublicAuctionId, cancellationToken);
            if (auction.PendingBidRequestId == notification.RequestId) auction.RejectPendingBid();
        }, cancellationToken);
    }
}

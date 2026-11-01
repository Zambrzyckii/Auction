using AuctionServer.Modules.Casino.Application.Interfaces;
using AuctionServer.Shared.Integration.Events.Casino;
using MediatR;

namespace AuctionServer.Modules.Casino.Application.Handlers;

public sealed class CasinoChipPurchaseRejectedEventHandler(ICasinoRepository repository)
    : INotificationHandler<CasinoChipPurchaseRejectedEvent>
{
    public Task Handle(CasinoChipPurchaseRejectedEvent notification, CancellationToken cancellationToken)
    {
        return repository.ApplyOnceAsync(notification.EventId, async () =>
        {
            var purchase = await repository.GetPurchaseByPublicIdAsync(notification.PublicPurchaseId, cancellationToken);
            purchase.Reject(notification.Reason, DateTime.UtcNow);
        }, cancellationToken);
    }
}

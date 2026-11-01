using AuctionServer.Modules.Casino.Application.Interfaces;
using AuctionServer.Shared.Integration.Events.Casino;
using MediatR;

namespace AuctionServer.Modules.Casino.Application.Handlers;

public sealed class CasinoChipPurchaseCompletedEventHandler(ICasinoRepository repository)
    : INotificationHandler<CasinoChipPurchaseCompletedEvent>
{
    public Task Handle(CasinoChipPurchaseCompletedEvent notification, CancellationToken cancellationToken)
    {
        return repository.ApplyOnceAsync(notification.EventId, async () =>
        {
            var purchase = await repository.GetPurchaseByPublicIdAsync(notification.PublicPurchaseId, cancellationToken);
            purchase.Complete(DateTime.UtcNow);

            var account = await repository.GetAccountByUserIdAsync(purchase.UserId, cancellationToken);
            account.ReceivePurchase(purchase.Amount);
        }, cancellationToken);
    }
}

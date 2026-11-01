using AuctionServer.Modules.Pawnshop.Application.Interfaces;
using AuctionServer.Shared.Integration.Events.Pawnshop;
using MediatR;

namespace AuctionServer.Modules.Pawnshop.Application.Handlers;

public sealed class PawnshopPaymentRejectedEventHandler(IPawnshopRepository repository)
    : INotificationHandler<PawnshopPaymentRejectedEvent>
{
    public Task Handle(PawnshopPaymentRejectedEvent notification, CancellationToken cancellationToken)
    {
        return repository.ApplyOnceAsync(notification.EventId, async () =>
        {
            var shop = await repository.GetShopByPublicIdAsync(notification.PublicPawnshopId, cancellationToken);
            shop.RejectPayment(notification.PaymentId, notification.Reason);
        }, cancellationToken);
    }
}

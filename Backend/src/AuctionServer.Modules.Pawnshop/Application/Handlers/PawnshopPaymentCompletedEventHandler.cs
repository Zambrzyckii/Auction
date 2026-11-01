using AuctionServer.Modules.Pawnshop.Application.Interfaces;
using AuctionServer.Shared.Integration.Events.Pawnshop;
using MediatR;

namespace AuctionServer.Modules.Pawnshop.Application.Handlers;

public sealed class PawnshopPaymentCompletedEventHandler(IPawnshopRepository repository)
    : INotificationHandler<PawnshopPaymentCompletedEvent>
{
    public Task Handle(PawnshopPaymentCompletedEvent notification, CancellationToken cancellationToken)
    {
        return repository.ApplyOnceAsync(notification.EventId, async () =>
        {
            var shop = await repository.GetShopByPublicIdAsync(notification.PublicPawnshopId, cancellationToken);
            shop.CompletePayment(notification.PaymentId, DateTime.UtcNow);
        }, cancellationToken);
    }
}

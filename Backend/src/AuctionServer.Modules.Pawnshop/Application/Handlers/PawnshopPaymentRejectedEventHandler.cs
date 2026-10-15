using AuctionServer.Modules.Pawnshop.Application.Interfaces;
using AuctionServer.Modules.Pawnshop.Domain.Exceptions;
using AuctionServer.Modules.Pawnshop.Infrastructure.Inbox;
using AuctionServer.Shared.Integration.Events.Pawnshop;
using MediatR;

namespace AuctionServer.Modules.Pawnshop.Application.Handlers;

public sealed class PawnshopPaymentRejectedEventHandler(IPawnshopRepository repository)
    : INotificationHandler<PawnshopPaymentRejectedEvent>
{
    public async Task Handle(PawnshopPaymentRejectedEvent notification, CancellationToken cancellationToken)
    {
        if (await repository.WasEventProcessedAsync(notification.EventId, cancellationToken)) return;

        var shop = await repository.GetShopByPublicIdAsync(notification.PublicPawnshopId, cancellationToken);
        shop.RejectPayment(notification.PaymentId, notification.Reason);

        try
        {
            await repository.SaveShopWithInboxAsync(new ProcessedMessage { EventId = notification.EventId },
                CancellationToken.None);
        }
        catch (PawnshopExceptions.EventAlreadyProcessedException)
        {
        }
    }
}

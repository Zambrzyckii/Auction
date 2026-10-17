using AuctionServer.Modules.Casino.Application.Interfaces;
using AuctionServer.Modules.Casino.Domain.Exceptions;
using AuctionServer.Modules.Casino.Infrastructure.Inbox;
using AuctionServer.Shared.Integration.Events.Casino;
using MediatR;

namespace AuctionServer.Modules.Casino.Application.Handlers;

public sealed class CasinoChipPurchaseRejectedEventHandler(ICasinoRepository repository)
    : INotificationHandler<CasinoChipPurchaseRejectedEvent>
{
    public async Task Handle(CasinoChipPurchaseRejectedEvent notification, CancellationToken cancellationToken)
    {
        if (await repository.WasEventProcessedAsync(notification.EventId, cancellationToken)) return;

        var purchase = await repository.GetPurchaseByPublicIdAsync(notification.PublicPurchaseId, cancellationToken);
        purchase.Reject(notification.Reason, DateTime.UtcNow);

        try
        {
            await repository.SaveChangesWithInboxAsync(new ProcessedMessage { EventId = notification.EventId },
                CancellationToken.None);
        }
        catch (CasinoExceptions.EventAlreadyProcessedException)
        {
        }
    }
}

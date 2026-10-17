using AuctionServer.Modules.Casino.Application.Interfaces;
using AuctionServer.Modules.Casino.Domain.Exceptions;
using AuctionServer.Modules.Casino.Infrastructure.Inbox;
using AuctionServer.Shared.Integration.Events.Casino;
using MediatR;

namespace AuctionServer.Modules.Casino.Application.Handlers;

public sealed class CasinoChipPurchaseCompletedEventHandler(ICasinoRepository repository)
    : INotificationHandler<CasinoChipPurchaseCompletedEvent>
{
    public async Task Handle(CasinoChipPurchaseCompletedEvent notification, CancellationToken cancellationToken)
    {
        if (await repository.WasEventProcessedAsync(notification.EventId, cancellationToken)) return;

        var purchase = await repository.GetPurchaseByPublicIdAsync(notification.PublicPurchaseId, cancellationToken);
        purchase.Complete(DateTime.UtcNow);

        var account = await repository.GetAccountByUserIdAsync(purchase.UserId, cancellationToken);
        account.ReceivePurchase(purchase.Amount);

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

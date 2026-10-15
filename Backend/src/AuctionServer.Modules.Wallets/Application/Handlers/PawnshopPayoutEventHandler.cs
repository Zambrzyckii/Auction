using AuctionServer.Modules.Wallets.Application.Interfaces.Persistence;
using AuctionServer.Modules.Wallets.Domain.Exceptions;
using AuctionServer.Modules.Wallets.Infrastructure.Inbox;
using AuctionServer.Shared.Integration.Events.Pawnshop;
using MediatR;

namespace AuctionServer.Modules.Wallets.Application.Handlers;

public sealed class PawnshopPayoutEventHandler(IWalletRepository repository) : INotificationHandler<PawnshopPayoutEvent>
{
    public async Task Handle(PawnshopPayoutEvent notification, CancellationToken cancellationToken)
    {
        if (await repository.WasEventProcessedAsync(notification.EventId, cancellationToken)) return;

        var wallet = await repository.GetUserWalletByIdAsync(notification.UserId, cancellationToken);
        wallet.AddFunds(notification.Amount);

        var processedMessage = new ProcessedMessage { EventId = notification.EventId };
        try
        {
            await repository.SaveUserFundsWithInboxAsync(processedMessage, CancellationToken.None);
        }
        catch (WalletExceptions.EventAlreadyProcessedException)
        {
        }
    }
}

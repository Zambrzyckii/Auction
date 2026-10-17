using AuctionServer.Modules.Wallets.Application.Interfaces.Persistence;
using AuctionServer.Modules.Wallets.Domain.Exceptions;
using AuctionServer.Modules.Wallets.Infrastructure.Inbox;
using AuctionServer.Shared.Integration.Events.Casino;
using MediatR;

namespace AuctionServer.Modules.Wallets.Application.Handlers;

public sealed class CasinoCashOutEventHandler(IWalletRepository repository) : INotificationHandler<CasinoCashOutEvent>
{
    public async Task Handle(CasinoCashOutEvent notification, CancellationToken cancellationToken)
    {
        if (await repository.WasEventProcessedAsync(notification.EventId, cancellationToken)) return;

        var wallet = await repository.GetUserWalletByIdAsync(notification.UserId, cancellationToken);
        wallet.ReceiveCasinoCashOut(notification.Amount);

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

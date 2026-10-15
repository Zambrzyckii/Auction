using AuctionServer.Modules.Wallets.Application.Interfaces.Persistence;
using AuctionServer.Modules.Wallets.Domain.Exceptions;
using AuctionServer.Modules.Wallets.Infrastructure.Inbox;
using AuctionServer.Shared.Integration.Events.Funds;
using MediatR;

namespace AuctionServer.Modules.Wallets.Application.Handlers;

public sealed class FundsUnlockRequestedEventHandler(IWalletRepository repository) : INotificationHandler<FundsUnlockRequestedEvent>
{
    public async Task Handle(FundsUnlockRequestedEvent notification, CancellationToken cancellationToken)
    {
        if (await repository.WasEventProcessedAsync(notification.EventId, cancellationToken)) return;

        var wallet = await repository.GetUserWalletByIdAsync(notification.BidderUserId, cancellationToken);
        try
        {
            wallet.ReleaseLock(notification.PublicAuctionId);
        }
        catch (WalletExceptions.LockNotFoundException)
        {
        }

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

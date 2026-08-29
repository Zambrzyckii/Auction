using AuctionServer.Modules.Wallets.Application.Interfaces.Persistence;
using AuctionServer.Modules.Wallets.Domain.Exceptions;
using AuctionServer.Modules.Wallets.Infrastructure.Inbox;
using AuctionServer.Shared.Integration.Events;
using MediatR;

namespace AuctionServer.Modules.Wallets.Application.Handlers;

public sealed class BidPlacedEventHandler(IWalletRepository repository) : INotificationHandler<BidPlacedEvent> 
{
    public async Task Handle(BidPlacedEvent notification, CancellationToken token)
    {
        if (await repository.WasEventProcessedAsync(notification.EventId, token)) return;
        
        var newWinnerWallet = await repository.GetUserWalletByIdAsync(notification.NewWinningUserId, token);
        newWinnerWallet.LockFunds(notification.NewPrice);

        if (notification is { PreviousWinningUserId: not null, PreviousPrice: not null })
        {
            var previousWinnerWallet = await repository.GetUserWalletByIdAsync(notification.PreviousWinningUserId.Value, token);
            previousWinnerWallet.UnlockFunds(notification.PreviousPrice.Value);
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
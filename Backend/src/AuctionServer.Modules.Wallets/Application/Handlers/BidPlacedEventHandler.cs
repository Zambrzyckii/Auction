using AuctionServer.Modules.Wallets.Application.Interfaces.Persistence;
using AuctionServer.Modules.Wallets.Domain.Exceptions;
using AuctionServer.Modules.Wallets.Infrastructure.Inbox;
using AuctionServer.Shared.Integration.Events.Auctions;
using MediatR;

namespace AuctionServer.Modules.Wallets.Application.Handlers;

public sealed class BidPlacedEventHandler(IWalletRepository repository) : INotificationHandler<BidPlacedEvent> 
{
    public async Task Handle(BidPlacedEvent notification, CancellationToken token)
    {
        if (await repository.WasEventProcessedAsync(notification.EventId, token)) return;

        if (notification.PreviousWinningUserId is not null)
        {
            var previousWinnerWallet = await repository.GetUserWalletByIdAsync(notification.PreviousWinningUserId.Value, token);
            previousWinnerWallet.ReleaseLock(notification.PublicAuctionId);
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
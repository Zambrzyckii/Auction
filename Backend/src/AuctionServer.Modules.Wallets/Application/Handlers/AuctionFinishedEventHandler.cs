using AuctionServer.Modules.Wallets.Application.Interfaces.Persistence;
using AuctionServer.Modules.Wallets.Domain.Exceptions;
using AuctionServer.Modules.Wallets.Infrastructure.Inbox;
using AuctionServer.Shared.Integration.Events;
using MediatR;

namespace AuctionServer.Modules.Wallets.Application.Handlers;

public sealed class AuctionFinishedEventHandler(IWalletRepository repository) : INotificationHandler<AuctionFinishedEvent>
{
    public async Task Handle(AuctionFinishedEvent notification, CancellationToken cancellationToken)
    {
        if (notification.WinnerUserId is null || notification.FinalPrice is null) return;

        var winnerWallet = await repository.GetUserWalletByIdAsync(notification.WinnerUserId.Value, cancellationToken);
        var sellerWallet = await repository.GetUserWalletByIdAsync(notification.SellerUserId, cancellationToken);
        
        winnerWallet.SpendLockedFunds(notification.FinalPrice.Value);
        sellerWallet.AddFunds(notification.FinalPrice.Value);

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
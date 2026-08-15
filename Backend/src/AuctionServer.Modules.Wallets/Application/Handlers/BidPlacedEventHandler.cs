using AuctionServer.Modules.Wallets.Application.Interfaces.Persistence;
using AuctionServer.Shared.Integration.Events;
using MediatR;

namespace AuctionServer.Modules.Wallets.Application.Handlers;

public sealed class BidPlacedEventHandler(IWalletRepository repository) : INotificationHandler<BidPlacedEvent> 
{
    public async Task Handle(BidPlacedEvent notification, CancellationToken token)
    {
        var newWinnerWallet = await repository.GetUserWalletByIdAsync(notification.NewWinningUserId, token);
        newWinnerWallet.LockFunds(notification.NewPrice);

        if (notification is { PreviousWinningUserId: not null, PreviousPrice: not null })
        {
            var previousWinnerWallet = await repository.GetUserWalletByIdAsync(notification.PreviousWinningUserId.Value, token);
            previousWinnerWallet.UnlockFunds(notification.PreviousPrice.Value);
        }
        await repository.SaveUserFundsAsync(CancellationToken.None);
    }
}
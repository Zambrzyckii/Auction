using AuctionServer.Modules.Wallets.Application.Interfaces.Persistence;
using AuctionServer.Shared.Integration.Events;
using MediatR;

namespace AuctionServer.Modules.Wallets.Application.Handlers;

public sealed class BidPlacedEventHandler(IWalletRepository repository) : INotificationHandler<BidPlacedEvent> 
{
    public async Task Handle(BidPlacedEvent notification, CancellationToken token)
    {
        var wallet = await repository.GetUserWalletByIdAsync(notification.NewWinningUserId, token);
        wallet!.LockFunds(notification.NewPrice);
        await repository.SaveUserFundsAsync(token);
    }
}
using AuctionServer.Modules.Wallets.Application.Interfaces.Persistence;
using AuctionServer.Shared.Integration.Events.Auctions;
using MediatR;

namespace AuctionServer.Modules.Wallets.Application.Handlers;

public sealed class BidPlacedEventHandler(IWalletRepository repository) : INotificationHandler<BidPlacedEvent>
{
    public Task Handle(BidPlacedEvent notification, CancellationToken token)
    {
        return repository.ApplyOnceAsync(notification.EventId, async () =>
        {
            if (notification.PreviousWinningUserId is null) return;

            var previousWinnerWallet = await repository.GetUserWalletByIdAsync(notification.PreviousWinningUserId.Value, token);
            previousWinnerWallet.ReleaseLock(notification.PublicAuctionId);
        }, token);
    }
}

using AuctionServer.Modules.Wallets.Application.Interfaces.Persistence;
using AuctionServer.Modules.Wallets.Domain.Exceptions;
using AuctionServer.Shared.Integration.Events.Funds;
using MediatR;

namespace AuctionServer.Modules.Wallets.Application.Handlers;

public sealed class FundsUnlockRequestedEventHandler(IWalletRepository repository) : INotificationHandler<FundsUnlockRequestedEvent>
{
    public Task Handle(FundsUnlockRequestedEvent notification, CancellationToken cancellationToken)
    {
        return repository.ApplyOnceAsync(notification.EventId, async () =>
        {
            var wallet = await repository.GetUserWalletByIdAsync(notification.BidderUserId, cancellationToken);
            try
            {
                wallet.ReleaseLock(notification.PublicAuctionId);
            }
            catch (WalletExceptions.LockNotFoundException)
            {
            }
        }, cancellationToken);
    }
}

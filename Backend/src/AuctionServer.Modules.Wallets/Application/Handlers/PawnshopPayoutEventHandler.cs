using AuctionServer.Modules.Wallets.Application.Interfaces.Persistence;
using AuctionServer.Shared.Integration.Events.Pawnshop;
using MediatR;

namespace AuctionServer.Modules.Wallets.Application.Handlers;

public sealed class PawnshopPayoutEventHandler(IWalletRepository repository) : INotificationHandler<PawnshopPayoutEvent>
{
    public Task Handle(PawnshopPayoutEvent notification, CancellationToken cancellationToken)
    {
        return repository.ApplyOnceAsync(notification.EventId, async () =>
        {
            var wallet = await repository.GetUserWalletByIdAsync(notification.UserId, cancellationToken);
            wallet.AddFunds(notification.Amount);
        }, cancellationToken);
    }
}

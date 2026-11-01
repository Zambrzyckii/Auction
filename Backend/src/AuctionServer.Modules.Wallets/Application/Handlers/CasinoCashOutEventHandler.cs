using AuctionServer.Modules.Wallets.Application.Interfaces.Persistence;
using AuctionServer.Shared.Integration.Events.Casino;
using MediatR;

namespace AuctionServer.Modules.Wallets.Application.Handlers;

public sealed class CasinoCashOutEventHandler(IWalletRepository repository) : INotificationHandler<CasinoCashOutEvent>
{
    public Task Handle(CasinoCashOutEvent notification, CancellationToken cancellationToken)
    {
        return repository.ApplyOnceAsync(notification.EventId, async () =>
        {
            var wallet = await repository.GetUserWalletByIdAsync(notification.UserId, cancellationToken);
            wallet.ReceiveCasinoCashOut(notification.Amount);
        }, cancellationToken);
    }
}

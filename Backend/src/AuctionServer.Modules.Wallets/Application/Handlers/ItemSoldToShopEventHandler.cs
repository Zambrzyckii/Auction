using AuctionServer.Modules.Wallets.Application.Interfaces.Persistence;
using AuctionServer.Shared.Integration.Events.Items;
using MediatR;

namespace AuctionServer.Modules.Wallets.Application.Handlers;

public sealed class ItemSoldToShopEventHandler(IWalletRepository repository) : INotificationHandler<ItemSoldToShopEvent>
{
    public Task Handle(ItemSoldToShopEvent notification, CancellationToken cancellationToken)
    {
        return repository.ApplyOnceAsync(notification.EventId, async () =>
        {
            var wallet = await repository.GetUserWalletByIdAsync(notification.OwnerUserId, cancellationToken);
            wallet.AddFunds(notification.Price);
        }, cancellationToken);
    }
}

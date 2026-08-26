using AuctionServer.Modules.Wallets.Application.Interfaces.Persistence;
using AuctionServer.Modules.Wallets.Domain.Exceptions;
using AuctionServer.Modules.Wallets.Infrastructure.Inbox;
using AuctionServer.Shared.Integration.Events;
using MediatR;

namespace AuctionServer.Modules.Wallets.Application.Handlers;

public sealed class ItemSoldToShopEventHandler(IWalletRepository repository) : INotificationHandler<ItemSoldToShopEvent>
{
    public async Task Handle(ItemSoldToShopEvent notification, CancellationToken cancellationToken)
    {
        if (await repository.WasEventProcessedAsync(notification.EventId, cancellationToken)) return;

        var wallet = await repository.GetUserWalletByIdAsync(notification.OwnerUserId, cancellationToken);
        wallet.AddFunds(notification.Price);

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
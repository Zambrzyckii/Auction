using AuctionServer.Modules.Wallets.Application.Interfaces.Persistence;
using AuctionServer.Modules.Wallets.Domain.Exceptions;
using AuctionServer.Modules.Wallets.Infrastructure.Inbox;
using AuctionServer.Shared.Integration.Events.Warehouses;
using MediatR;

namespace AuctionServer.Modules.Wallets.Application.Handlers;

public sealed class WarehouseWonEventHandler(IWalletRepository repository) : INotificationHandler<WarehouseWonEvent>
{
    public async Task Handle(WarehouseWonEvent notification, CancellationToken cancellationToken)
    {
        if (await repository.WasEventProcessedAsync(notification.EventId, cancellationToken)) return;

        var winnerWallet = await repository.GetUserWalletByIdAsync(notification.WinnerUserId, cancellationToken);

        // The final price leaves the economy on purpose: there is no seller to credit in a warehouse war.
        winnerWallet.SpendLock(notification.PublicWarehouseId, notification.FinalPrice);

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

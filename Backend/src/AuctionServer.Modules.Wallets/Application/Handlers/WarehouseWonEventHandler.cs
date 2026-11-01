using System.Text.Json;
using AuctionServer.Modules.Wallets.Application.Interfaces.Persistence;
using AuctionServer.Modules.Wallets.Domain.Exceptions;
using AuctionServer.Modules.Wallets.Infrastructure.Inbox;
using AuctionServer.Shared.Infrastructure.Outbox;
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
        var eventId = Guid.NewGuid();
        var outboxMessage = new OutboxMessage
        {
            Id = eventId,
            Type = nameof(WarehouseSettledEvent),
            Content = JsonSerializer.Serialize(new WarehouseSettledEvent(
                eventId, notification.PublicWarehouseId, notification.WinnerUserId, notification.Stock))
        };

        try
        {
            await repository.SaveUserFundsWithInboxAndOutboxAsync(processedMessage, outboxMessage, CancellationToken.None);
        }
        catch (WalletExceptions.EventAlreadyProcessedException)
        {
        }
    }
}

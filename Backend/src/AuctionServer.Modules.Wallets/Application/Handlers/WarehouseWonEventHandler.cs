using System.Text.Json;
using AuctionServer.Modules.Wallets.Application.Interfaces.Persistence;
using AuctionServer.Shared.Infrastructure.Outbox;
using AuctionServer.Shared.Integration.Events.Warehouses;
using MediatR;

namespace AuctionServer.Modules.Wallets.Application.Handlers;

public sealed class WarehouseWonEventHandler(IWalletRepository repository) : INotificationHandler<WarehouseWonEvent>
{
    public Task Handle(WarehouseWonEvent notification, CancellationToken cancellationToken)
    {
        return repository.ApplyOnceAsync(notification.EventId, async () =>
        {
            var winnerWallet = await repository.GetUserWalletByIdAsync(notification.WinnerUserId, cancellationToken);

            // The final price leaves the economy on purpose: there is no seller to credit in a warehouse war.
            winnerWallet.SpendLock(notification.PublicWarehouseId, notification.FinalPrice);

            var eventId = Guid.NewGuid();
            return (OutboxMessage?)new OutboxMessage
            {
                Id = eventId,
                Type = nameof(WarehouseSettledEvent),
                Content = JsonSerializer.Serialize(new WarehouseSettledEvent(
                    eventId, notification.PublicWarehouseId, notification.WinnerUserId, notification.Stock))
            };
        }, cancellationToken);
    }
}

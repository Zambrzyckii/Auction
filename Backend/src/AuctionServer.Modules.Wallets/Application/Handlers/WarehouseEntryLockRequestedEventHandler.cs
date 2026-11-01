using System.Text.Json;
using AuctionServer.Modules.Wallets.Application.Interfaces.Persistence;
using AuctionServer.Modules.Wallets.Domain.Exceptions;
using AuctionServer.Shared.Infrastructure.Outbox;
using AuctionServer.Shared.Integration.Events.Warehouses;
using MediatR;

namespace AuctionServer.Modules.Wallets.Application.Handlers;

public sealed class WarehouseEntryLockRequestedEventHandler(IWalletRepository repository)
    : INotificationHandler<WarehouseEntryLockRequestedEvent>
{
    public Task Handle(WarehouseEntryLockRequestedEvent notification, CancellationToken cancellationToken)
    {
        return repository.ApplyOnceAsync(notification.EventId, async () =>
        {
            var wallet = await repository.GetUserWalletByIdAsync(notification.UserId, cancellationToken);

            var replyId = Guid.NewGuid();
            OutboxMessage reply;
            try
            {
                wallet.LockFunds(notification.PublicWarehouseId, notification.Amount);
                reply = new OutboxMessage
                {
                    Id = replyId,
                    Type = nameof(WarehouseEntryLockedEvent),
                    Content = JsonSerializer.Serialize(new WarehouseEntryLockedEvent(
                        replyId, notification.PublicWarehouseId, notification.UserId, notification.EventId))
                };
            }
            catch (Exception e) when (e is WalletExceptions.InsufficientFundsException
                                          or WalletExceptions.LockAlreadyExistsException)
            {
                reply = new OutboxMessage
                {
                    Id = replyId,
                    Type = nameof(WarehouseEntryLockRejectedEvent),
                    Content = JsonSerializer.Serialize(new WarehouseEntryLockRejectedEvent(
                        replyId, notification.PublicWarehouseId, notification.UserId, e.Message, notification.EventId))
                };
            }

            return (OutboxMessage?)reply;
        }, cancellationToken);
    }
}

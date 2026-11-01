using System.Text.Json;
using AuctionServer.Modules.Wallets.Application.Interfaces.Persistence;
using AuctionServer.Modules.Wallets.Domain.Exceptions;
using AuctionServer.Shared.Infrastructure.Outbox;
using AuctionServer.Shared.Integration.Events.Funds;
using MediatR;

namespace AuctionServer.Modules.Wallets.Application.Handlers;

public sealed class FundsLockRequestedEventHandler(IWalletRepository repository) : INotificationHandler<FundsLockRequestedEvent>
{
    public Task Handle(FundsLockRequestedEvent notification, CancellationToken cancellationToken)
    {
        return repository.ApplyOnceAsync(notification.EventId, async () =>
        {
            var wallet = await repository.GetUserWalletByIdAsync(notification.BidderUserId, cancellationToken);

            var replyId = Guid.NewGuid();
            OutboxMessage reply;
            try
            {
                wallet.LockFunds(notification.PublicAuctionId, notification.Amount);
                reply = new OutboxMessage
                {
                    Id = replyId,
                    Type = nameof(FundsLockedEvent),
                    Content = JsonSerializer.Serialize(new FundsLockedEvent(replyId, notification.PublicAuctionId,
                        notification.BidderUserId, notification.Amount, notification.EventId))
                };
            }
            catch (Exception e) when (e is WalletExceptions.InsufficientFundsException
                                          or WalletExceptions.LockAlreadyExistsException)
            {
                reply = new OutboxMessage
                {
                    Id = replyId,
                    Type = nameof(FundsLockRejectedEvent),
                    Content = JsonSerializer.Serialize(new FundsLockRejectedEvent(
                        replyId, notification.PublicAuctionId, notification.BidderUserId, e.Message, notification.EventId))
                };
            }

            return (OutboxMessage?)reply;
        }, cancellationToken);
    }
}

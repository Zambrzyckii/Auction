using System.Text.Json;
using AuctionServer.Modules.Wallets.Application.Interfaces.Persistence;
using AuctionServer.Modules.Wallets.Domain.Exceptions;
using AuctionServer.Shared.Infrastructure.Outbox;
using AuctionServer.Shared.Integration.Events.Casino;
using MediatR;

namespace AuctionServer.Modules.Wallets.Application.Handlers;

public sealed class CasinoChipPurchaseRequestedEventHandler(IWalletRepository repository) : INotificationHandler<CasinoChipPurchaseRequestedEvent>
{
    public Task Handle(CasinoChipPurchaseRequestedEvent notification, CancellationToken cancellationToken)
    {
        return repository.ApplyOnceAsync(notification.EventId, async () =>
        {
            var wallet = await repository.GetUserWalletByIdAsync(notification.UserId, cancellationToken);

            var replyId = Guid.NewGuid();
            OutboxMessage reply;
            try
            {
                wallet.Withdraw(notification.Amount);
                reply = new OutboxMessage
                {
                    Id = replyId,
                    Type = nameof(CasinoChipPurchaseCompletedEvent),
                    Content = JsonSerializer.Serialize(new CasinoChipPurchaseCompletedEvent(
                        replyId, notification.PublicPurchaseId, notification.UserId))
                };
            }
            catch (WalletExceptions.InsufficientFundsException e)
            {
                reply = new OutboxMessage
                {
                    Id = replyId,
                    Type = nameof(CasinoChipPurchaseRejectedEvent),
                    Content = JsonSerializer.Serialize(new CasinoChipPurchaseRejectedEvent(
                        replyId, notification.PublicPurchaseId, notification.UserId, e.Message))
                };
            }

            return (OutboxMessage?)reply;
        }, cancellationToken);
    }
}

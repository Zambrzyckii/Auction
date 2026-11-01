using System.Text.Json;
using AuctionServer.Modules.Wallets.Application.Interfaces.Persistence;
using AuctionServer.Modules.Wallets.Domain.Exceptions;
using AuctionServer.Shared.Infrastructure.Outbox;
using AuctionServer.Shared.Integration.Events.Pawnshop;
using MediatR;

namespace AuctionServer.Modules.Wallets.Application.Handlers;

public sealed class PawnshopPaymentRequestedEventHandler(IWalletRepository repository) : INotificationHandler<PawnshopPaymentRequestedEvent>
{
    public Task Handle(PawnshopPaymentRequestedEvent notification, CancellationToken cancellationToken)
    {
        return repository.ApplyOnceAsync(notification.EventId, async () =>
        {
            var wallet = await repository.GetUserWalletByIdAsync(notification.UserId, cancellationToken);

            var replyId = Guid.NewGuid();
            OutboxMessage reply;
            try
            {
                wallet.PayForPawnshop(notification.Amount, notification.RequiredTurnover);
                reply = new OutboxMessage
                {
                    Id = replyId,
                    Type = nameof(PawnshopPaymentCompletedEvent),
                    Content = JsonSerializer.Serialize(new PawnshopPaymentCompletedEvent(
                        replyId, notification.PublicPawnshopId, notification.PaymentId, notification.UserId))
                };
            }
            catch (Exception e) when (e is WalletExceptions.InsufficientTurnoverException or WalletExceptions.InsufficientFundsException)
            {
                reply = new OutboxMessage
                {
                    Id = replyId,
                    Type = nameof(PawnshopPaymentRejectedEvent),
                    Content = JsonSerializer.Serialize(new PawnshopPaymentRejectedEvent(
                        replyId, notification.PublicPawnshopId, notification.PaymentId, notification.UserId, e.Message))
                };
            }

            return (OutboxMessage?)reply;
        }, cancellationToken);
    }
}

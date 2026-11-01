using System.Text.Json;
using AuctionServer.Modules.Wallets.Application.Interfaces.Persistence;
using AuctionServer.Shared.Infrastructure.Outbox;
using AuctionServer.Shared.Integration.Events.Banking;
using MediatR;

namespace AuctionServer.Modules.Wallets.Application.Handlers;

public sealed class LoanRepaymentRequestedEventHandler(IWalletRepository repository)
    : INotificationHandler<LoanRepaymentRequestedEvent>
{
    public Task Handle(LoanRepaymentRequestedEvent notification, CancellationToken cancellationToken)
    {
        return repository.ApplyOnceAsync(notification.EventId, async () =>
        {
            var wallet = await repository.GetUserWalletByIdAsync(notification.UserId, cancellationToken);

            var collected = wallet.CollectUpTo(notification.Amount);

            var replyId = Guid.NewGuid();
            return (OutboxMessage?)new OutboxMessage
            {
                Id = replyId,
                Type = nameof(LoanRepaymentCollectedEvent),
                Content = JsonSerializer.Serialize(new LoanRepaymentCollectedEvent(
                    replyId, notification.PublicLoanId, notification.UserId, collected))
            };
        }, cancellationToken);
    }
}

using System.Text.Json;
using AuctionServer.Modules.Wallets.Application.Interfaces.Persistence;
using AuctionServer.Modules.Wallets.Domain.Exceptions;
using AuctionServer.Modules.Wallets.Infrastructure.Inbox;
using AuctionServer.Modules.Wallets.Infrastructure.Outbox;
using AuctionServer.Shared.Integration.Events.Banking;
using MediatR;

namespace AuctionServer.Modules.Wallets.Application.Handlers;

public sealed class LoanRepaymentRequestedEventHandler(IWalletRepository repository)
    : INotificationHandler<LoanRepaymentRequestedEvent>
{
    public async Task Handle(LoanRepaymentRequestedEvent notification, CancellationToken cancellationToken)
    {
        if (await repository.WasEventProcessedAsync(notification.EventId, cancellationToken)) return;

        var wallet = await repository.GetUserWalletByIdAsync(notification.UserId, cancellationToken);

        var collected = wallet.CollectUpTo(notification.Amount);

        var replyId = Guid.NewGuid();
        var reply = new OutboxMessage
        {
            Id = replyId,
            Type = nameof(LoanRepaymentCollectedEvent),
            Content = JsonSerializer.Serialize(new LoanRepaymentCollectedEvent(
                replyId, notification.PublicLoanId, notification.UserId, collected))
        };

        var processedMessage = new ProcessedMessage { EventId = notification.EventId };
        try
        {
            await repository.SaveUserFundsWithInboxAndOutboxAsync(processedMessage, reply, CancellationToken.None);
        }
        catch (WalletExceptions.EventAlreadyProcessedException)
        {
        }
    }
}

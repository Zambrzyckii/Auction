using System.Text.Json;
using AuctionServer.Modules.Wallets.Application.Interfaces.Persistence;
using AuctionServer.Modules.Wallets.Domain.Exceptions;
using AuctionServer.Modules.Wallets.Infrastructure.Inbox;
using AuctionServer.Modules.Wallets.Infrastructure.Outbox;
using AuctionServer.Shared.Integration.Events.Banking;
using MediatR;

namespace AuctionServer.Modules.Wallets.Application.Handlers;

public sealed class LoanRequestedEventHandler(IWalletRepository repository) : INotificationHandler<LoanRequestedEvent>
{
    public async Task Handle(LoanRequestedEvent notification, CancellationToken cancellationToken)
    {
        if (await repository.WasEventProcessedAsync(notification.EventId, cancellationToken)) return;

        var wallet = await repository.GetUserWalletByIdAsync(notification.UserId, cancellationToken);

        var replyId = Guid.NewGuid();
        OutboxMessage reply;
        try
        {
            // The turnover check and the credit are one entity call, so they commit atomically below.
            wallet.DisburseLoan(notification.Principal, notification.RequiredTurnover);
            reply = new OutboxMessage
            {
                Id = replyId,
                Type = nameof(LoanApprovedEvent),
                Content = JsonSerializer.Serialize(new LoanApprovedEvent(
                    replyId, notification.PublicLoanId, notification.UserId))
            };
        }
        catch (WalletExceptions.InsufficientTurnoverException e)
        {
            reply = new OutboxMessage
            {
                Id = replyId,
                Type = nameof(LoanRejectedEvent),
                Content = JsonSerializer.Serialize(new LoanRejectedEvent(
                    replyId, notification.PublicLoanId, notification.UserId, e.Message))
            };
        }

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

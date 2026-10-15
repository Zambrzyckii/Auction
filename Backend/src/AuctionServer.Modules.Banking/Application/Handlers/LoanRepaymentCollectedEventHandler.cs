using AuctionServer.Modules.Banking.Application.Interfaces;
using AuctionServer.Modules.Banking.Domain.Exceptions;
using AuctionServer.Modules.Banking.Infrastructure.Inbox;
using AuctionServer.Shared.Integration.Events.Banking;
using MediatR;

namespace AuctionServer.Modules.Banking.Application.Handlers;

public sealed class LoanRepaymentCollectedEventHandler(IBankingRepository repository)
    : INotificationHandler<LoanRepaymentCollectedEvent>
{
    public async Task Handle(LoanRepaymentCollectedEvent notification, CancellationToken token)
    {
        if (await repository.WasEventProcessedAsync(notification.EventId, token)) return;

        var loan = await repository.GetLoanByPublicIdAsync(notification.PublicLoanId, token);
        loan.ApplyCollection(notification.AmountCollected, DateTime.UtcNow);

        var processedMessage = new ProcessedMessage { EventId = notification.EventId };
        try
        {
            await repository.SaveLoanWithInboxAsync(processedMessage, CancellationToken.None);
        }
        catch (BankingExceptions.EventAlreadyProcessedException)
        {
        }
    }
}

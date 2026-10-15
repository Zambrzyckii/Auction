using AuctionServer.Modules.Banking.Application.Interfaces;
using AuctionServer.Modules.Banking.Domain.Exceptions;
using AuctionServer.Modules.Banking.Infrastructure.Inbox;
using AuctionServer.Shared.Integration.Events.Banking;
using MediatR;

namespace AuctionServer.Modules.Banking.Application.Handlers;

public sealed class LoanRejectedEventHandler(IBankingRepository repository) : INotificationHandler<LoanRejectedEvent>
{
    public async Task Handle(LoanRejectedEvent notification, CancellationToken token)
    {
        if (await repository.WasEventProcessedAsync(notification.EventId, token)) return;

        var loan = await repository.GetLoanByPublicIdAsync(notification.PublicLoanId, token);
        loan.Reject(notification.Reason);

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

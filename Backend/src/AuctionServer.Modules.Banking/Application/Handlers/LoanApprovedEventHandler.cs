using AuctionServer.Modules.Banking.Application.Interfaces;
using AuctionServer.Modules.Banking.Domain.Exceptions;
using AuctionServer.Modules.Banking.Infrastructure.Inbox;
using AuctionServer.Shared.Integration.Events.Banking;
using MediatR;

namespace AuctionServer.Modules.Banking.Application.Handlers;

public sealed class LoanApprovedEventHandler(IBankingRepository repository) : INotificationHandler<LoanApprovedEvent>
{
    public async Task Handle(LoanApprovedEvent notification, CancellationToken token)
    {
        if (await repository.WasEventProcessedAsync(notification.EventId, token)) return;

        var loan = await repository.GetLoanByPublicIdAsync(notification.PublicLoanId, token);
        loan.Approve(DateTime.UtcNow);

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

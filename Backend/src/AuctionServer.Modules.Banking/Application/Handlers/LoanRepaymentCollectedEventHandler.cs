using AuctionServer.Modules.Banking.Application.Interfaces;
using AuctionServer.Shared.Integration.Events.Banking;
using MediatR;

namespace AuctionServer.Modules.Banking.Application.Handlers;

public sealed class LoanRepaymentCollectedEventHandler(IBankingRepository repository)
    : INotificationHandler<LoanRepaymentCollectedEvent>
{
    public Task Handle(LoanRepaymentCollectedEvent notification, CancellationToken token)
    {
        return repository.ApplyOnceAsync(notification.EventId, async () =>
        {
            var loan = await repository.GetLoanByPublicIdAsync(notification.PublicLoanId, token);
            loan.ApplyCollection(notification.AmountCollected, DateTime.UtcNow);
        }, token);
    }
}

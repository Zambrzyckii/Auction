using AuctionServer.Modules.Banking.Application.Interfaces;
using AuctionServer.Shared.Integration.Events.Banking;
using MediatR;

namespace AuctionServer.Modules.Banking.Application.Handlers;

public sealed class LoanRejectedEventHandler(IBankingRepository repository) : INotificationHandler<LoanRejectedEvent>
{
    public Task Handle(LoanRejectedEvent notification, CancellationToken token)
    {
        return repository.ApplyOnceAsync(notification.EventId, async () =>
        {
            var loan = await repository.GetLoanByPublicIdAsync(notification.PublicLoanId, token);
            loan.Reject(notification.Reason);
        }, token);
    }
}

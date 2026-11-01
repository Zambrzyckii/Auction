using AuctionServer.Modules.Banking.Application.Interfaces;
using AuctionServer.Shared.Integration.Events.Banking;
using MediatR;

namespace AuctionServer.Modules.Banking.Application.Handlers;

public sealed class LoanApprovedEventHandler(IBankingRepository repository) : INotificationHandler<LoanApprovedEvent>
{
    public Task Handle(LoanApprovedEvent notification, CancellationToken token)
    {
        return repository.ApplyOnceAsync(notification.EventId, async () =>
        {
            var loan = await repository.GetLoanByPublicIdAsync(notification.PublicLoanId, token);
            loan.Approve(DateTime.UtcNow);
        }, token);
    }
}

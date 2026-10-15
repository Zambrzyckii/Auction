using System.Text.Json;
using AuctionServer.Modules.Banking.Application.Interfaces;
using AuctionServer.Modules.Banking.Domain.Exceptions;
using AuctionServer.Modules.Banking.Infrastructure.Outbox;
using AuctionServer.Shared.Integration.Events.Banking;
using MediatR;

namespace AuctionServer.Modules.Banking.Application.Command.RepayLoan;

public class RepayLoanCommandHandler(IBankingRepository repository) : IRequestHandler<RepayLoanCommand>
{
    public async Task Handle(RepayLoanCommand request, CancellationToken token)
    {
        var loan = await repository.GetLoanByPublicIdAsync(request.PublicLoanId, token);

        if (request.UserId != loan.UserId) throw new BankingExceptions.LoanNotFoundException(request.PublicLoanId);

        var outstanding = loan.RequestCollection(DateTime.UtcNow);

        var eventId = Guid.NewGuid();
        var outboxMessage = new OutboxMessage
        {
            Id = eventId,
            Type = nameof(LoanRepaymentRequestedEvent),
            Content = JsonSerializer.Serialize(new LoanRepaymentRequestedEvent(
                eventId, loan.PublicLoanId, loan.UserId, outstanding))
        };
        await repository.SaveLoanWithOutboxAsync(outboxMessage, CancellationToken.None);
    }
}

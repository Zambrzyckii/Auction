using System.Text.Json;
using AuctionServer.Modules.Banking.Application.Interfaces;
using AuctionServer.Modules.Banking.Application.Options;
using AuctionServer.Modules.Banking.Domain.Entities;
using AuctionServer.Modules.Banking.Domain.Exceptions;
using AuctionServer.Modules.Banking.Infrastructure.Outbox;
using AuctionServer.Shared.Integration.Events.Banking;
using MediatR;

namespace AuctionServer.Modules.Banking.Application.Command.CreateLoan;

public class CreateLoanCommandHandler(IBankingRepository repository, BankingOptions options)
    : IRequestHandler<CreateLoanCommand, Guid>
{
    public async Task<Guid> Handle(CreateLoanCommand request, CancellationToken token)
    {
        var offer = options.Offers.SingleOrDefault(o => o.Name == request.OfferName)
                    ?? throw new BankingExceptions.LoanOfferNotFoundException(request.OfferName);

        var loan = Loan.Create(request.UserId, offer.Name, offer.Principal, offer.InterestRate,
            options.PenaltyRate, offer.RequiredTurnover, offer.Term);

        var eventId = Guid.NewGuid();
        var outboxMessage = new OutboxMessage
        {
            Id = eventId,
            Type = nameof(LoanRequestedEvent),
            Content = JsonSerializer.Serialize(new LoanRequestedEvent(
                eventId, loan.PublicLoanId, request.UserId, loan.Principal, loan.RequiredTurnover))
        };
        await repository.SaveNewLoanWithOutboxAsync(loan, outboxMessage, token);
        return loan.PublicLoanId;
    }
}

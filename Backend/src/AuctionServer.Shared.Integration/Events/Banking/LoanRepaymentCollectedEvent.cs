using MediatR;

namespace AuctionServer.Shared.Integration.Events.Banking;

public record LoanRepaymentCollectedEvent(Guid EventId, Guid PublicLoanId, Guid UserId, decimal AmountCollected) : INotification;

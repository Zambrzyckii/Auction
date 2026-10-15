using MediatR;

namespace AuctionServer.Shared.Integration.Events.Banking;

public record LoanRepaymentRequestedEvent(Guid EventId, Guid PublicLoanId, Guid UserId, decimal Amount) : INotification;

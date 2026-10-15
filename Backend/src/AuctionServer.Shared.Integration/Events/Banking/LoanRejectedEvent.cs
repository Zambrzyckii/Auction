using MediatR;

namespace AuctionServer.Shared.Integration.Events.Banking;

public record LoanRejectedEvent(Guid EventId, Guid PublicLoanId, Guid UserId, string Reason) : INotification;

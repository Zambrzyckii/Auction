using MediatR;

namespace AuctionServer.Shared.Integration.Events.Banking;

public record LoanRequestedEvent(Guid EventId, Guid PublicLoanId, Guid UserId, decimal Principal, decimal RequiredTurnover) : INotification;

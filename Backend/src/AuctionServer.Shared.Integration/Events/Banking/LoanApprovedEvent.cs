using MediatR;

namespace AuctionServer.Shared.Integration.Events.Banking;

public record LoanApprovedEvent(Guid EventId, Guid PublicLoanId, Guid UserId) : INotification;

using MediatR;

namespace AuctionServer.Modules.Banking.Application.Command.RepayLoan;

public record RepayLoanCommand(Guid UserId, Guid PublicLoanId) : IRequest;

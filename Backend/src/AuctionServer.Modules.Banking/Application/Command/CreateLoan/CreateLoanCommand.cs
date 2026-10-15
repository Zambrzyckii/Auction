using MediatR;

namespace AuctionServer.Modules.Banking.Application.Command.CreateLoan;

public record CreateLoanCommand(Guid UserId, string OfferName) : IRequest<Guid>;

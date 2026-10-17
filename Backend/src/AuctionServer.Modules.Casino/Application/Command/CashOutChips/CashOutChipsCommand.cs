using MediatR;

namespace AuctionServer.Modules.Casino.Application.Command.CashOutChips;

public record CashOutChipsCommand(Guid UserId, decimal Amount) : IRequest;

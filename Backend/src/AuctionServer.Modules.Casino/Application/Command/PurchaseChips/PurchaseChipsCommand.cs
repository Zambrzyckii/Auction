using MediatR;

namespace AuctionServer.Modules.Casino.Application.Command.PurchaseChips;

public record PurchaseChipsCommand(Guid UserId, decimal Amount) : IRequest<Guid>;

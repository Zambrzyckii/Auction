using MediatR;

namespace AuctionServer.Modules.Pawnshop.Application.Command.OpenPawnshop;

public record OpenPawnshopCommand(Guid UserId) : IRequest<Guid>;

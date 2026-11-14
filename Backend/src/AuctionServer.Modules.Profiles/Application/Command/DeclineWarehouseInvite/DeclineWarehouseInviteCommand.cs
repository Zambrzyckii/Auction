using MediatR;

namespace AuctionServer.Modules.Profiles.Application.Command.DeclineWarehouseInvite;

public record DeclineWarehouseInviteCommand(Guid UserId, Guid PublicInviteId) : IRequest;

using MediatR;

namespace AuctionServer.Modules.Profiles.Application.Command.CreateWarehouseInvite;

public record CreateWarehouseInviteCommand(Guid UserId, Guid FriendUserId, Guid PublicWarehouseId) : IRequest;

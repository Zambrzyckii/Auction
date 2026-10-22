using AuctionServer.Modules.Profiles.Domain.Enums;
using MediatR;

namespace AuctionServer.Modules.Profiles.Application.Command.RequestFriendship;

public record RequestFriendshipCommand(Guid UserId, Guid TargetUserId) : IRequest<FriendRequestDto>;

public record FriendRequestDto(Guid PublicFriendshipId, FriendshipStatus Status);

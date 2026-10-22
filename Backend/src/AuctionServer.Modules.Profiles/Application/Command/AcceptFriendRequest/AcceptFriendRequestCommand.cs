using MediatR;

namespace AuctionServer.Modules.Profiles.Application.Command.AcceptFriendRequest;

public record AcceptFriendRequestCommand(Guid UserId, Guid PublicFriendshipId) : IRequest;

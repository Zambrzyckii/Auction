using MediatR;

namespace AuctionServer.Modules.Profiles.Application.Command.DeclineFriendRequest;

public record DeclineFriendRequestCommand(Guid UserId, Guid PublicFriendshipId) : IRequest;

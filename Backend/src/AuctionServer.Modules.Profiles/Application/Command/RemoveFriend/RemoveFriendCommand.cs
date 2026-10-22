using MediatR;

namespace AuctionServer.Modules.Profiles.Application.Command.RemoveFriend;

public record RemoveFriendCommand(Guid UserId, Guid OtherUserId) : IRequest;

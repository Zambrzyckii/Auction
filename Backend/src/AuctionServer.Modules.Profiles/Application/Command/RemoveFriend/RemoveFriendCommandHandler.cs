using AuctionServer.Modules.Profiles.Application.Interfaces;
using AuctionServer.Modules.Profiles.Domain;
using AuctionServer.Modules.Profiles.Domain.Exceptions;
using MediatR;

namespace AuctionServer.Modules.Profiles.Application.Command.RemoveFriend;

public sealed class RemoveFriendCommandHandler(IProfilesRepository repository)
    : IRequestHandler<RemoveFriendCommand>
{
    public async Task Handle(RemoveFriendCommand request, CancellationToken token)
    {
        var (low, high) = FriendshipPair.Normalize(request.UserId, request.OtherUserId);
        var friendship = await repository.FindFriendshipAsync(low, high, token)
            ?? throw new ProfilesExceptions.FriendshipNotFoundException();

        await repository.RemoveFriendshipWithPairInvitesAsync(friendship, token);
    }
}

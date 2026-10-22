using AuctionServer.Modules.Profiles.Application.Interfaces;
using AuctionServer.Modules.Profiles.Domain.Enums;
using AuctionServer.Modules.Profiles.Domain.Exceptions;
using MediatR;

namespace AuctionServer.Modules.Profiles.Application.Command.DeclineFriendRequest;

public sealed class DeclineFriendRequestCommandHandler(IProfilesRepository repository)
    : IRequestHandler<DeclineFriendRequestCommand>
{
    public async Task Handle(DeclineFriendRequestCommand request, CancellationToken token)
    {
        var friendship = await repository.GetFriendshipAsync(request.PublicFriendshipId, token);

        if (friendship.AddresseeId != request.UserId || friendship.Status != FriendshipStatus.Pending)
            throw new ProfilesExceptions.FriendRequestNotFoundException();

        await repository.RemoveFriendshipAsync(friendship, token);
    }
}

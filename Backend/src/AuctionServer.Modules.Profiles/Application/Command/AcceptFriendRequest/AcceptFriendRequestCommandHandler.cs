using AuctionServer.Modules.Profiles.Application.Interfaces;
using MediatR;

namespace AuctionServer.Modules.Profiles.Application.Command.AcceptFriendRequest;

public sealed class AcceptFriendRequestCommandHandler(IProfilesRepository repository)
    : IRequestHandler<AcceptFriendRequestCommand>
{
    public async Task Handle(AcceptFriendRequestCommand request, CancellationToken token)
    {
        var friendship = await repository.GetFriendshipAsync(request.PublicFriendshipId, token);

        friendship.Accept(request.UserId);

        await repository.SaveChangesAsync(token);
    }
}

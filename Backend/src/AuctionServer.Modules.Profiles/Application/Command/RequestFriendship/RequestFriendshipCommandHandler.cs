using AuctionServer.Modules.Profiles.Application.Interfaces;
using AuctionServer.Modules.Profiles.Domain;
using AuctionServer.Modules.Profiles.Domain.Entities;
using AuctionServer.Modules.Profiles.Domain.Enums;
using AuctionServer.Modules.Profiles.Domain.Exceptions;
using MediatR;

namespace AuctionServer.Modules.Profiles.Application.Command.RequestFriendship;

public sealed class RequestFriendshipCommandHandler(IProfilesRepository repository)
    : IRequestHandler<RequestFriendshipCommand, FriendRequestDto>
{
    public async Task<FriendRequestDto> Handle(RequestFriendshipCommand request, CancellationToken token)
    {
        if (await repository.FindProfileReadOnlyAsync(request.TargetUserId, token) is null)
            throw new ProfilesExceptions.ProfileNotFoundException();

        var (low, high) = FriendshipPair.Normalize(request.UserId, request.TargetUserId);
        var existing = await repository.FindFriendshipAsync(low, high, token);
        if (existing is not null)
        {
            if (existing.Status == FriendshipStatus.Pending && existing.AddresseeId == request.UserId)
            {
                existing.Accept(request.UserId);
                await repository.SaveChangesAsync(token);
                return new FriendRequestDto(existing.PublicFriendshipId, existing.Status);
            }
            throw new ProfilesExceptions.FriendshipAlreadyExistsException();
        }

        if (await repository.CountAcceptedFriendshipsAsync(request.UserId, token) >= Friendship.MaxFriends
            || await repository.CountAcceptedFriendshipsAsync(request.TargetUserId, token) >= Friendship.MaxFriends)
            throw new ProfilesExceptions.FriendLimitReachedException();

        var friendship = Friendship.Create(request.UserId, request.TargetUserId, DateTime.UtcNow);
        await repository.AddFriendshipAsync(friendship, token);

        return new FriendRequestDto(friendship.PublicFriendshipId, friendship.Status);
    }
}

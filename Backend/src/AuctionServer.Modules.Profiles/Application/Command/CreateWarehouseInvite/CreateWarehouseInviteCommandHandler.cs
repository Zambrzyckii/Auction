using AuctionServer.Modules.Profiles.Application.Interfaces;
using AuctionServer.Modules.Profiles.Application.Options;
using AuctionServer.Modules.Profiles.Domain;
using AuctionServer.Modules.Profiles.Domain.Entities;
using AuctionServer.Modules.Profiles.Domain.Enums;
using AuctionServer.Modules.Profiles.Domain.Exceptions;
using MediatR;

namespace AuctionServer.Modules.Profiles.Application.Command.CreateWarehouseInvite;

public sealed class CreateWarehouseInviteCommandHandler(IProfilesRepository repository, ProfilesOptions options)
    : IRequestHandler<CreateWarehouseInviteCommand>
{
    public async Task Handle(CreateWarehouseInviteCommand request, CancellationToken token)
    {
        var (low, high) = FriendshipPair.Normalize(request.UserId, request.FriendUserId);
        var friendship = await repository.FindFriendshipAsync(low, high, token);
        if (friendship is null || friendship.Status != FriendshipStatus.Accepted)
            throw new ProfilesExceptions.NotFriendsException();

        await repository.PurgeExpiredWarehouseInvitesAsync(DateTime.UtcNow - options.Invites.Lifetime, token);

        var invite = WarehouseInvite.Create(
            request.UserId, request.FriendUserId, request.PublicWarehouseId, DateTime.UtcNow);
        await repository.AddWarehouseInviteAsync(invite, token);
    }
}

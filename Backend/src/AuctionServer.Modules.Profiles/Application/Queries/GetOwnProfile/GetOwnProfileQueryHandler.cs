using AuctionServer.Modules.Profiles.Application.Interfaces;
using AuctionServer.Modules.Profiles.Domain.Exceptions;
using MediatR;

namespace AuctionServer.Modules.Profiles.Application.Queries.GetOwnProfile;

public sealed class GetOwnProfileQueryHandler(IProfilesRepository repository)
    : IRequestHandler<GetOwnProfileQuery, OwnProfileDto>
{
    public async Task<OwnProfileDto> Handle(GetOwnProfileQuery request, CancellationToken cancellationToken)
    {
        var profile = await repository.FindProfileReadOnlyAsync(request.UserId, cancellationToken);

        if (profile is null) throw new ProfilesExceptions.ProfileNotFoundException();

        var avatarUrl = profile.AvatarHash is null
            ? null
            : $"/api/profiles/{profile.UserId}/avatar?v={profile.AvatarHash[..12]}";
        var friends = await repository.GetAcceptedFriendsAsync(request.UserId, cancellationToken);
        var pending = await repository.GetPendingFriendshipsAsync(request.UserId, cancellationToken);

        return new OwnProfileDto(profile.UserId, profile.Username, profile.IsPrivate, profile.Level, profile.CreatedOn,
            avatarUrl,
            friends.Select(f => new FriendDto(f.UserId, f.Username)).ToList(),
            pending.Where(p => p.Incoming)
                .Select(p => new PendingFriendRequestDto(p.PublicFriendshipId, p.UserId, p.Username)).ToList(),
            pending.Where(p => !p.Incoming)
                .Select(p => new PendingFriendRequestDto(p.PublicFriendshipId, p.UserId, p.Username)).ToList(),
            profile.SocialLinks.OrderBy(l => l.Platform)
                .Select(l => new SocialLinkDto(l.Platform, l.Url)).ToList());
    }
}

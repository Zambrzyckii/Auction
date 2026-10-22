using AuctionServer.Modules.Profiles.Application.Interfaces;
using AuctionServer.Modules.Profiles.Domain;
using AuctionServer.Modules.Profiles.Domain.Enums;
using AuctionServer.Modules.Profiles.Domain.Exceptions;
using MediatR;

namespace AuctionServer.Modules.Profiles.Application.Queries.GetProfile;

public sealed class GetProfileQueryHandler(IProfilesRepository repository)
    : IRequestHandler<GetProfileQuery, ProfileDto>
{
    public async Task<ProfileDto> Handle(GetProfileQuery request, CancellationToken cancellationToken)
    {
        var profile = await repository.FindProfileReadOnlyAsync(request.PublicUserId, cancellationToken);

        if (profile is null) throw new ProfilesExceptions.ProfileNotFoundException();

        var avatarUrl = profile.AvatarHash is null
            ? null
            : $"/api/profiles/{profile.UserId}/avatar?v={profile.AvatarHash[..12]}";

        var restricted = profile.IsPrivate && request.ViewerId != profile.UserId;
        if (restricted)
        {
            var (low, high) = FriendshipPair.Normalize(request.ViewerId, profile.UserId);
            var friendship = await repository.FindFriendshipAsync(low, high, cancellationToken);
            restricted = friendship is null || friendship.Status != FriendshipStatus.Accepted;
        }

        if (restricted)
            return new ProfileDto(profile.UserId, profile.Username, true, null, null, avatarUrl, [], []);

        var friends = await repository.GetAcceptedFriendsAsync(request.PublicUserId, cancellationToken);

        return new ProfileDto(profile.UserId, profile.Username, profile.IsPrivate, profile.Level,
            profile.CreatedOn,
            avatarUrl,
            friends.Select(f => new FriendDto(f.UserId, f.Username)).ToList(),
            profile.SocialLinks.OrderBy(l => l.Platform)
                .Select(l => new SocialLinkDto(l.Platform, l.Url)).ToList());
    }
}

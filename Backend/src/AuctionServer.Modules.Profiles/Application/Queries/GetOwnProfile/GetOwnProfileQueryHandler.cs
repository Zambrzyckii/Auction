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

        return new OwnProfileDto(profile.UserId, profile.Username, profile.Level, profile.CreatedOn,
            avatarUrl,
            profile.SocialLinks.OrderBy(l => l.Platform)
                .Select(l => new SocialLinkDto(l.Platform, l.Url)).ToList());
    }
}

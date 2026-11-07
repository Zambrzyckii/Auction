using AuctionServer.Modules.Profiles.Application.Interfaces;
using AuctionServer.Modules.Profiles.Domain.Exceptions;
using MediatR;

namespace AuctionServer.Modules.Profiles.Application.Queries.GetAvatar;

public sealed class GetAvatarQueryHandler(
    IProfilesRepository repository,
    IAvatarStorage storage) : IRequestHandler<GetAvatarQuery, AvatarStreamDto>
{
    public async Task<AvatarStreamDto> Handle(GetAvatarQuery request, CancellationToken token)
    {
        var profile = await repository.FindProfileReadOnlyAsync(request.PublicUserId, token);

        if (profile?.AvatarHash is null) throw new ProfilesExceptions.AvatarNotFoundException();

        if (ClientHasCurrentAvatar(request.IfNoneMatch, profile.AvatarHash))
            return new AvatarStreamDto(null, null, profile.AvatarHash);

        var download = await storage.GetAsync(request.PublicUserId, token)
            ?? throw new ProfilesExceptions.AvatarNotFoundException();

        return new AvatarStreamDto(download.Content, download.ContentType, profile.AvatarHash);
    }

    private static bool ClientHasCurrentAvatar(string? ifNoneMatch, string currentHash)
    {
        if (ifNoneMatch is null || string.IsNullOrEmpty(ifNoneMatch)) return false;

        return ifNoneMatch
            .Split(',')
            .Select(t => t.Trim())
            .Select(t => t.StartsWith("W/") ? t[2..] : t)
            .Select(t => t.Trim('"'))
            .Any(t => t == "*" || string.Equals(t, currentHash, StringComparison.Ordinal));
    }
}

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

        var download = await storage.GetAsync(request.PublicUserId, token)
            ?? throw new ProfilesExceptions.AvatarNotFoundException();

        return new AvatarStreamDto(download.Content, download.ContentType, profile.AvatarHash);
    }
}

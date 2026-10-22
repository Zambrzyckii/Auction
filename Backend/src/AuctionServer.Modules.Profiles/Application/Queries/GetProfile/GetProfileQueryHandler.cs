using AuctionServer.Modules.Profiles.Application.Interfaces;
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

        return new ProfileDto(profile.UserId, profile.Username, profile.Level, profile.CreatedOn);
    }
}

using AuctionServer.Modules.Profiles.Application.Interfaces;
using MediatR;

namespace AuctionServer.Modules.Profiles.Application.Queries.SearchProfiles;

public sealed class SearchProfilesQueryHandler(IProfilesRepository repository)
    : IRequestHandler<SearchProfilesQuery, IReadOnlyList<ProfileSummaryDto>>
{
    public async Task<IReadOnlyList<ProfileSummaryDto>> Handle(
        SearchProfilesQuery request, CancellationToken cancellationToken)
    {
        var rows = await repository.SearchProfileSummariesAsync(request.Query.Trim(), request.Limit, cancellationToken);

        return rows
            .Select(r => new ProfileSummaryDto(r.UserId, r.Username, AvatarLinks.For(r.UserId, r.AvatarHash)))
            .ToList();
    }
}

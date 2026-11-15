using AuctionServer.Modules.Profiles.Application.Interfaces;
using MediatR;

namespace AuctionServer.Modules.Profiles.Application.Queries.GetProfileSummaries;

public sealed class GetProfileSummariesQueryHandler(IProfilesRepository repository)
    : IRequestHandler<GetProfileSummariesQuery, IReadOnlyList<ProfileSummaryDto>>
{
    public async Task<IReadOnlyList<ProfileSummaryDto>> Handle(
        GetProfileSummariesQuery request, CancellationToken cancellationToken)
    {
        var rows = await repository.GetProfileSummariesAsync(request.UserIds, cancellationToken);

        return rows
            .Select(r => new ProfileSummaryDto(r.UserId, r.Username, AvatarLinks.For(r.UserId, r.AvatarHash)))
            .ToList();
    }
}

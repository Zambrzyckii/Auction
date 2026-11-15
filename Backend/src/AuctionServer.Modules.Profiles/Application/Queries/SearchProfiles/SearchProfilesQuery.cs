using MediatR;

namespace AuctionServer.Modules.Profiles.Application.Queries.SearchProfiles;

public record SearchProfilesQuery(string Query, int Limit) : IRequest<IReadOnlyList<ProfileSummaryDto>>;

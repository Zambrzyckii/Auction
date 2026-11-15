using MediatR;

namespace AuctionServer.Modules.Profiles.Application.Queries.GetProfileSummaries;

public record GetProfileSummariesQuery(IReadOnlyList<Guid> UserIds) : IRequest<IReadOnlyList<ProfileSummaryDto>>;

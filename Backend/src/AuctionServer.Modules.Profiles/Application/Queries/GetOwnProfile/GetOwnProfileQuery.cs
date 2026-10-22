using MediatR;

namespace AuctionServer.Modules.Profiles.Application.Queries.GetOwnProfile;

public record GetOwnProfileQuery(Guid UserId) : IRequest<OwnProfileDto>;

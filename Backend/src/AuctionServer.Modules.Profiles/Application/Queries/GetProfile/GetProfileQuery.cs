using MediatR;

namespace AuctionServer.Modules.Profiles.Application.Queries.GetProfile;

public record GetProfileQuery(Guid PublicUserId) : IRequest<ProfileDto>;

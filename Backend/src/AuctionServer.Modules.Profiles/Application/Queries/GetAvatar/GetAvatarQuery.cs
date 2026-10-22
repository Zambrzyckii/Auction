using MediatR;

namespace AuctionServer.Modules.Profiles.Application.Queries.GetAvatar;

public record GetAvatarQuery(Guid PublicUserId) : IRequest<AvatarStreamDto>;

public sealed record AvatarStreamDto(Stream Content, string ContentType, string Hash);

using AuctionServer.Modules.Profiles.Domain.Enums;
using MediatR;

namespace AuctionServer.Modules.Profiles.Application.Command.ReplaceSocialLinks;

public record ReplaceSocialLinksCommand(Guid UserId, IReadOnlyList<SocialLinkRequest> Links) : IRequest;

public record SocialLinkRequest(SocialPlatform Platform, string Url);

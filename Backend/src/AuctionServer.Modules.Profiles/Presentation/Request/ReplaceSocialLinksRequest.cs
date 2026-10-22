using AuctionServer.Modules.Profiles.Application.Command.ReplaceSocialLinks;

namespace AuctionServer.Modules.Profiles.Presentation.Request;

public record ReplaceSocialLinksRequest(IReadOnlyList<SocialLinkRequest> Links);

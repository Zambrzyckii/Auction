using AuctionServer.Modules.Profiles.Domain.Enums;
using AuctionServer.Modules.Profiles.Domain.Exceptions;

namespace AuctionServer.Modules.Profiles.Domain;

public static class SocialLinkPolicy
{
    public const int MaxLinks = 6;

    private static readonly IReadOnlyDictionary<SocialPlatform, string> AllowedDomains =
        new Dictionary<SocialPlatform, string>
        {
            [SocialPlatform.Twitch] = "twitch.tv",
            [SocialPlatform.YouTube] = "youtube.com",
            [SocialPlatform.X] = "x.com",
            [SocialPlatform.Instagram] = "instagram.com",
            [SocialPlatform.GitHub] = "github.com",
            [SocialPlatform.Steam] = "steamcommunity.com",
            [SocialPlatform.Discord] = "discord.gg"
        };

    public static void Validate(SocialPlatform platform, string url)
    {
        if (!Uri.TryCreate(url, UriKind.Absolute, out var uri) || uri.Scheme != Uri.UriSchemeHttps)
            throw new ProfilesExceptions.InvalidSocialLinkException(
                $"Link for {platform} must be an absolute https url");
        if (uri.UserInfo.Length > 0)
            throw new ProfilesExceptions.InvalidSocialLinkException(
                $"Link for {platform} must not carry user info");

        if (platform == SocialPlatform.Website)
        {
            if (uri.HostNameType != UriHostNameType.Dns
                || string.Equals(uri.Host, "localhost", StringComparison.OrdinalIgnoreCase))
                throw new ProfilesExceptions.InvalidSocialLinkException(
                    "Website link must point at a public dns host");
            return;
        }

        var domain = AllowedDomains[platform];
        var hostAllowed = string.Equals(uri.Host, domain, StringComparison.OrdinalIgnoreCase)
            || uri.Host.EndsWith("." + domain, StringComparison.OrdinalIgnoreCase);
        if (!hostAllowed)
            throw new ProfilesExceptions.InvalidSocialLinkException(
                $"Link for {platform} must point at {domain}");
    }
}

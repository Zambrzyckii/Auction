using AuctionServer.Modules.Profiles.Domain;
using AuctionServer.Modules.Profiles.Domain.Enums;
using AuctionServer.Modules.Profiles.Domain.Exceptions;

namespace AuctionServer.Modules.Profiles.Tests.Domain;

public class SocialLinkPolicyTests
{
    [Theory]
    [InlineData(SocialPlatform.Twitch, "https://twitch.tv/player")]
    [InlineData(SocialPlatform.Twitch, "https://m.twitch.tv/player")]
    [InlineData(SocialPlatform.YouTube, "https://www.youtube.com/@player")]
    [InlineData(SocialPlatform.X, "https://x.com/player")]
    [InlineData(SocialPlatform.Instagram, "https://instagram.com/player")]
    [InlineData(SocialPlatform.GitHub, "https://github.com/player")]
    [InlineData(SocialPlatform.Steam, "https://steamcommunity.com/id/player")]
    [InlineData(SocialPlatform.Discord, "https://discord.gg/abc123")]
    [InlineData(SocialPlatform.Website, "https://my-blog.example")]
    public void Validate_WithMatchingHost_ShouldPass(SocialPlatform platform, string url) =>
        SocialLinkPolicy.Validate(platform, url);

    [Theory]
    [InlineData(SocialPlatform.Twitch, "http://twitch.tv/player")]
    [InlineData(SocialPlatform.Twitch, "javascript:alert(1)")]
    [InlineData(SocialPlatform.Twitch, "data:text/html,x")]
    [InlineData(SocialPlatform.Twitch, "/player")]
    [InlineData(SocialPlatform.Twitch, "https://user:pass@twitch.tv/player")]
    [InlineData(SocialPlatform.Twitch, "https://twitch.tv.evil.com/player")]
    [InlineData(SocialPlatform.Twitch, "https://eviltwitch.tv/player")]
    [InlineData(SocialPlatform.X, "https://evilx.com/player")]
    [InlineData(SocialPlatform.YouTube, "https://x.com/player")]
    [InlineData(SocialPlatform.Website, "https://127.0.0.1/blog")]
    [InlineData(SocialPlatform.Website, "https://localhost/blog")]
    [InlineData(SocialPlatform.Website, "http://my-blog.example")]
    public void Validate_WithWrongSchemeOrHost_ShouldThrow(SocialPlatform platform, string url) =>
        Assert.Throws<ProfilesExceptions.InvalidSocialLinkException>(() => SocialLinkPolicy.Validate(platform, url));
}

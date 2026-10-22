using AuctionServer.Modules.Profiles.Domain.Entities;
using AuctionServer.Modules.Profiles.Domain.Enums;
using AuctionServer.Modules.Profiles.Domain.Exceptions;

namespace AuctionServer.Modules.Profiles.Tests.Domain.Entities;

public class UserProfileSocialLinksTests
{
    private static UserProfile CreateProfile() =>
        UserProfile.Create(Guid.NewGuid(), "player-one", DateTime.UtcNow);

    [Fact]
    public void ReplaceSocialLinks_ShouldStoreLinksAndRegenerateVersion()
    {
        var profile = CreateProfile();
        var versionBefore = profile.Version;

        profile.ReplaceSocialLinks([
            (SocialPlatform.Twitch, "https://twitch.tv/player"),
            (SocialPlatform.GitHub, "https://github.com/player")
        ]);

        Assert.Equal(2, profile.SocialLinks.Count);
        Assert.NotEqual(versionBefore, profile.Version);
    }

    [Fact]
    public void ReplaceSocialLinks_ShouldUpdateExistingPlatformAndRemoveMissingOne()
    {
        var profile = CreateProfile();
        profile.ReplaceSocialLinks([
            (SocialPlatform.Twitch, "https://twitch.tv/old"),
            (SocialPlatform.GitHub, "https://github.com/player")
        ]);

        profile.ReplaceSocialLinks([(SocialPlatform.Twitch, "https://twitch.tv/new")]);

        var link = Assert.Single(profile.SocialLinks);
        Assert.Equal(SocialPlatform.Twitch, link.Platform);
        Assert.Equal("https://twitch.tv/new", link.Url);
    }

    [Fact]
    public void ReplaceSocialLinks_WithEmptyList_ShouldClearAllLinks()
    {
        var profile = CreateProfile();
        profile.ReplaceSocialLinks([(SocialPlatform.X, "https://x.com/player")]);

        profile.ReplaceSocialLinks([]);

        Assert.Empty(profile.SocialLinks);
    }

    [Fact]
    public void ReplaceSocialLinks_WithDuplicatePlatform_ShouldThrow()
    {
        var profile = CreateProfile();

        Assert.Throws<ProfilesExceptions.InvalidSocialLinkException>(() => profile.ReplaceSocialLinks([
            (SocialPlatform.X, "https://x.com/player"),
            (SocialPlatform.X, "https://x.com/other")
        ]));
    }

    [Fact]
    public void ReplaceSocialLinks_WithSevenLinks_ShouldThrow()
    {
        var profile = CreateProfile();
        var links = new (SocialPlatform, string)[]
        {
            (SocialPlatform.Twitch, "https://twitch.tv/p"),
            (SocialPlatform.YouTube, "https://youtube.com/@p"),
            (SocialPlatform.X, "https://x.com/p"),
            (SocialPlatform.Instagram, "https://instagram.com/p"),
            (SocialPlatform.GitHub, "https://github.com/p"),
            (SocialPlatform.Steam, "https://steamcommunity.com/id/p"),
            (SocialPlatform.Website, "https://blog.example")
        };

        Assert.Throws<ProfilesExceptions.InvalidSocialLinkException>(() => profile.ReplaceSocialLinks(links));
    }

    [Fact]
    public void ReplaceSocialLinks_WithInvalidUrl_ShouldNotChangeAnything()
    {
        var profile = CreateProfile();
        profile.ReplaceSocialLinks([(SocialPlatform.X, "https://x.com/player")]);
        var versionBefore = profile.Version;

        Assert.Throws<ProfilesExceptions.InvalidSocialLinkException>(() =>
            profile.ReplaceSocialLinks([(SocialPlatform.X, "http://x.com/player")]));

        var link = Assert.Single(profile.SocialLinks);
        Assert.Equal("https://x.com/player", link.Url);
        Assert.Equal(versionBefore, profile.Version);
    }
}

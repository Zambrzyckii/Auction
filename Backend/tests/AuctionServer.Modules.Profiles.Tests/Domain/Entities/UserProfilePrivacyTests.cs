using AuctionServer.Modules.Profiles.Domain.Entities;

namespace AuctionServer.Modules.Profiles.Tests.Domain.Entities;

public class UserProfilePrivacyTests
{
    private static UserProfile CreateProfile() =>
        UserProfile.Create(Guid.NewGuid(), "player", DateTime.UtcNow);

    [Fact]
    public void Create_ShouldBePublicByDefault()
    {
        var profile = CreateProfile();

        Assert.False(profile.IsPrivate);
    }

    [Fact]
    public void SetPrivacy_WhenEnabling_ShouldSetFlagAndRegenerateVersion()
    {
        var profile = CreateProfile();
        var versionBefore = profile.Version;

        profile.SetPrivacy(true);

        Assert.True(profile.IsPrivate);
        Assert.NotEqual(versionBefore, profile.Version);
    }

    [Fact]
    public void SetPrivacy_WhenValueUnchanged_ShouldKeepVersion()
    {
        var profile = CreateProfile();
        profile.SetPrivacy(true);
        var versionBefore = profile.Version;

        profile.SetPrivacy(true);

        Assert.Equal(versionBefore, profile.Version);
    }

    [Fact]
    public void SetPrivacy_WhenDisabling_ShouldClearFlag()
    {
        var profile = CreateProfile();
        profile.SetPrivacy(true);

        profile.SetPrivacy(false);

        Assert.False(profile.IsPrivate);
    }
}

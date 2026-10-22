using AuctionServer.Modules.Profiles.Domain.Entities;

namespace AuctionServer.Modules.Profiles.Tests.Domain.Entities;

public class UserProfileTests
{
    private static UserProfile CreateProfile() =>
        UserProfile.Create(Guid.NewGuid(), "player-one", DateTime.UtcNow);

    [Fact]
    public void Create_ShouldStartAtLevelZero()
    {
        var now = DateTime.UtcNow;
        var userId = Guid.NewGuid();

        var profile = UserProfile.Create(userId, "player-one", now);

        Assert.Equal(userId, profile.UserId);
        Assert.Equal("player-one", profile.Username);
        Assert.Equal(0, profile.Level);
        Assert.Equal(now, profile.CreatedOn);
    }

    [Fact]
    public void ApplyLevel_WhenHigher_ShouldRaiseLevelAndRegenerateVersion()
    {
        var profile = CreateProfile();
        var versionBefore = profile.Version;

        profile.ApplyLevel(3);

        Assert.Equal(3, profile.Level);
        Assert.NotEqual(versionBefore, profile.Version);
    }

    [Fact]
    public void ApplyLevel_WhenLower_ShouldKeepCurrentLevelAndVersion()
    {
        var profile = CreateProfile();
        profile.ApplyLevel(5);
        var versionBefore = profile.Version;

        profile.ApplyLevel(2);

        Assert.Equal(5, profile.Level);
        Assert.Equal(versionBefore, profile.Version);
    }

    [Fact]
    public void ApplyLevel_WhenEqual_ShouldChangeNothing()
    {
        var profile = CreateProfile();
        profile.ApplyLevel(4);
        var versionBefore = profile.Version;

        profile.ApplyLevel(4);

        Assert.Equal(4, profile.Level);
        Assert.Equal(versionBefore, profile.Version);
    }
}

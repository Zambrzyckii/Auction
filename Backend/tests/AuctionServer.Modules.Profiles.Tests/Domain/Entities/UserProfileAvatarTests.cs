using AuctionServer.Modules.Profiles.Domain.Entities;

namespace AuctionServer.Modules.Profiles.Tests.Domain.Entities;

public class UserProfileAvatarTests
{
    private static UserProfile CreateProfile() =>
        UserProfile.Create(Guid.NewGuid(), "player", DateTime.UtcNow);

    [Fact]
    public void SetAvatar_ShouldStoreMetadataAndRegenerateVersion()
    {
        var profile = CreateProfile();
        var versionBefore = profile.Version;
        var now = DateTime.UtcNow;

        profile.SetAvatar("image/png", "abc123", now);

        Assert.Equal("image/png", profile.AvatarContentType);
        Assert.Equal("abc123", profile.AvatarHash);
        Assert.Equal(now, profile.AvatarUpdatedOn);
        Assert.NotEqual(versionBefore, profile.Version);
    }

    [Fact]
    public void SetAvatar_WhenReplacing_ShouldOverwriteMetadata()
    {
        var profile = CreateProfile();
        profile.SetAvatar("image/png", "old-hash", DateTime.UtcNow);

        profile.SetAvatar("image/webp", "new-hash", DateTime.UtcNow);

        Assert.Equal("image/webp", profile.AvatarContentType);
        Assert.Equal("new-hash", profile.AvatarHash);
    }

    [Fact]
    public void ClearAvatar_ShouldRemoveMetadataAndRegenerateVersion()
    {
        var profile = CreateProfile();
        profile.SetAvatar("image/png", "abc123", DateTime.UtcNow);
        var versionBefore = profile.Version;

        profile.ClearAvatar();

        Assert.Null(profile.AvatarContentType);
        Assert.Null(profile.AvatarHash);
        Assert.Null(profile.AvatarUpdatedOn);
        Assert.NotEqual(versionBefore, profile.Version);
    }
}

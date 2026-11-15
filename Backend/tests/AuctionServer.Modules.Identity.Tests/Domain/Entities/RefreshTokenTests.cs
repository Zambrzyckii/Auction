using AuctionServer.Modules.Identity.Domain.Entities;

namespace AuctionServer.Modules.Identity.Tests.Domain.Entities;

public class RefreshTokenTests
{
    private static readonly DateTime Now = new(2026, 11, 15, 12, 0, 0, DateTimeKind.Utc);

    private static RefreshToken Issue() => RefreshToken.Issue(7, Guid.NewGuid(), "hash", Now);

    [Fact]
    public void Issue_ShouldStartActiveWithSevenDayExpiry()
    {
        var token = Issue();

        Assert.NotEqual(Guid.Empty, token.Id);
        Assert.Equal(Now, token.CreatedOn);
        Assert.Equal(Now.AddDays(7), token.ExpiresOn);
        Assert.Null(token.RevokedOn);
        Assert.True(token.IsActive(Now));
    }

    [Fact]
    public void IsActive_WhenExpiryIsReached_ShouldBeFalse()
    {
        var token = Issue();

        Assert.True(token.IsActive(token.ExpiresOn.AddTicks(-1)));
        Assert.False(token.IsActive(token.ExpiresOn));
    }

    [Fact]
    public void Revoke_ShouldDeactivateAndChangeVersion()
    {
        var token = Issue();
        var version = token.Version;

        token.Revoke(Now.AddMinutes(1));

        Assert.Equal(Now.AddMinutes(1), token.RevokedOn);
        Assert.False(token.IsActive(Now.AddMinutes(1)));
        Assert.NotEqual(version, token.Version);
    }

    [Fact]
    public void Revoke_WhenAlreadyRevoked_ShouldKeepTheFirstRevocationTime()
    {
        var token = Issue();
        token.Revoke(Now.AddMinutes(1));
        var version = token.Version;

        token.Revoke(Now.AddHours(1));

        Assert.Equal(Now.AddMinutes(1), token.RevokedOn);
        Assert.Equal(version, token.Version);
    }
}

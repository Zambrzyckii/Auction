using AuctionServer.Modules.Profiles.Domain;

namespace AuctionServer.Modules.Profiles.Tests.Domain;

public class FriendshipPairTests
{
    [Fact]
    public void Normalize_ShouldBeSymmetric()
    {
        var a = Guid.NewGuid();
        var b = Guid.NewGuid();

        Assert.Equal(FriendshipPair.Normalize(a, b), FriendshipPair.Normalize(b, a));
    }

    [Fact]
    public void Normalize_ShouldReturnLowBeforeHigh()
    {
        var a = Guid.NewGuid();
        var b = Guid.NewGuid();

        var (low, high) = FriendshipPair.Normalize(a, b);

        Assert.True(low.CompareTo(high) <= 0);
        Assert.Equal(new[] { a, b }.OrderBy(x => x), [low, high]);
    }

    [Fact]
    public void Normalize_WithEqualIds_ShouldReturnThemUnchanged()
    {
        var a = Guid.NewGuid();

        Assert.Equal((a, a), FriendshipPair.Normalize(a, a));
    }
}

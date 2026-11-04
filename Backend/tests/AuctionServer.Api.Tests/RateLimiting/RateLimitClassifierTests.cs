using AuctionServer.Api.Infrastructure.RateLimiting;

namespace AuctionServer.Api.Tests.RateLimiting;

public class RateLimitClassifierTests
{
    [Theory]
    [InlineData("GET", "/api/auctions")]
    [InlineData("GET", "/api/profiles/me")]
    [InlineData("HEAD", "/health")]
    public void Classify_Reads_ShouldBeUnlimited(string method, string path)
    {
        Assert.Null(RateLimitingExtensions.Classify(method, path));
    }

    [Theory]
    [InlineData("POST", "/api/casino/roulette/spins")]
    [InlineData("POST", "/api/casino/blackjack/hands/0199a7e2-0000-0000-0000-000000000000/actions")]
    [InlineData("POST", "/api/casino/chips/purchases")]
    [InlineData("POST", "/api/wallets/transfers")]
    [InlineData("POST", "/api/auctions/0199a7e2-0000-0000-0000-000000000000/bid")]
    [InlineData("POST", "/api/warehouses/0199a7e2-0000-0000-0000-000000000000/bids")]
    [InlineData("POST", "/api/warehouses/0199a7e2-0000-0000-0000-000000000000/join")]
    [InlineData("POST", "/api/warehouses/0199a7e2-0000-0000-0000-000000000000/leave")]
    public void Classify_HotPaths_ShouldUseTheHotPolicy(string method, string path)
    {
        Assert.Equal(RateLimitingExtensions.HotWritesClass, RateLimitingExtensions.Classify(method, path));
    }

    [Fact]
    public void Classify_AvatarUpload_ShouldUseTheUploadPolicy()
    {
        Assert.Equal(RateLimitingExtensions.UploadsClass,
            RateLimitingExtensions.Classify("PUT", "/api/profiles/me/avatar"));
    }

    [Theory]
    [InlineData("POST", "/api/auctions")]
    [InlineData("POST", "/api/users/register")]
    [InlineData("PUT", "/api/profiles/me/socials")]
    [InlineData("DELETE", "/api/profiles/me/avatar")]
    [InlineData("POST", "/api/bank/loans")]
    public void Classify_OtherWrites_ShouldUseTheUmbrellaPolicy(string method, string path)
    {
        Assert.Equal(RateLimitingExtensions.WritesClass, RateLimitingExtensions.Classify(method, path));
    }
}

using AuctionServer.Modules.Auctions.Application.Caching;
using AuctionServer.Modules.Auctions.Application.Options;
using AuctionServer.Modules.Auctions.Infrastructure.Caching;
using Microsoft.Extensions.DependencyInjection;

namespace AuctionServer.Modules.Auctions.Tests.Application;

public class AuctionModuleExtensionsTests
{
    private static void Add(AuctionReadCacheOptions options) =>
        new ServiceCollection().AddAuctionModule("Host=localhost", options);

    [Fact]
    public void AddAuctionModule_WithDefaultReadCacheOptions_ShouldNotThrow() => Add(new AuctionReadCacheOptions());

    [Fact]
    public void ReadCacheOptions_ByDefault_ShouldUseTwoSecondTtls()
    {
        var options = new AuctionReadCacheOptions();

        Assert.Equal(TimeSpan.FromSeconds(2), options.ListTtl);
        Assert.Equal(TimeSpan.FromSeconds(2), options.DetailTtl);
        Assert.Equal(TimeSpan.FromSeconds(2), options.BidsTtl);
    }

    [Theory]
    [InlineData(1)]
    [InlineData(60)]
    public void AddAuctionModule_WithBoundaryTtls_ShouldNotThrow(int seconds)
    {
        var ttl = TimeSpan.FromSeconds(seconds);

        Add(new AuctionReadCacheOptions { ListTtl = ttl, DetailTtl = ttl, BidsTtl = ttl });
    }

    public static TheoryData<string> InvalidCases => new()
    {
        "missing read cache options",
        "list ttl below one second",
        "list ttl above sixty seconds",
        "detail ttl below one second",
        "detail ttl above sixty seconds",
        "bids ttl below one second",
        "bids ttl above sixty seconds"
    };

    [Theory]
    [MemberData(nameof(InvalidCases))]
    public void AddAuctionModule_WithInvalidReadCacheOptions_ShouldThrow(string invalidCase)
    {
        var options = invalidCase switch
        {
            "missing read cache options" => null!,
            "list ttl below one second" => new AuctionReadCacheOptions { ListTtl = TimeSpan.FromMilliseconds(999) },
            "list ttl above sixty seconds" => new AuctionReadCacheOptions { ListTtl = TimeSpan.FromSeconds(61) },
            "detail ttl below one second" => new AuctionReadCacheOptions { DetailTtl = TimeSpan.Zero },
            "detail ttl above sixty seconds" => new AuctionReadCacheOptions { DetailTtl = TimeSpan.FromMinutes(2) },
            "bids ttl below one second" => new AuctionReadCacheOptions { BidsTtl = TimeSpan.FromMilliseconds(500) },
            "bids ttl above sixty seconds" => new AuctionReadCacheOptions { BidsTtl = TimeSpan.FromSeconds(61) },
            _ => throw new ArgumentOutOfRangeException(nameof(invalidCase))
        };

        Assert.Throws<ArgumentException>(() => Add(options));
    }

    [Fact]
    public void AddAuctionModule_ByDefault_ShouldRegisterPassThroughReadCache()
    {
        var services = new ServiceCollection();
        services.AddAuctionModule("Host=localhost", new AuctionReadCacheOptions());
        using var provider = services.BuildServiceProvider();

        Assert.IsType<PassThroughAuctionReadCache>(provider.GetRequiredService<IAuctionReadCache>());
    }
}

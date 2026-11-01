using AuctionServer.Modules.Auctions.Application.Options;
using AuctionServer.Modules.Auctions.Application.Queries.GetActiveAuctions;
using AuctionServer.Modules.Auctions.Application.Queries.GetAuctionBids;
using AuctionServer.Modules.Auctions.Application.Queries.GetAuctionById;

namespace AuctionServer.Modules.Auctions.Tests.Application;

public class CachedQueryTests
{
    private static readonly AuctionReadCacheOptions Options = new()
    {
        ListTtl = TimeSpan.FromSeconds(3),
        DetailTtl = TimeSpan.FromSeconds(4),
        BidsTtl = TimeSpan.FromSeconds(5)
    };

    [Fact]
    public void GetActiveAuctionsQuery_ShouldBuildListCacheKey()
    {
        var query = new GetActiveAuctionsQuery(25);

        Assert.Equal("auctions:list:v1:25", query.CacheKey);
    }

    [Fact]
    public void GetActiveAuctionsQuery_ShouldUseListTtl()
    {
        var query = new GetActiveAuctionsQuery(25);

        Assert.Equal(TimeSpan.FromSeconds(3), query.GetTtl(Options));
    }

    [Fact]
    public void GetAuctionByIdQuery_ShouldBuildDetailCacheKey()
    {
        var auctionId = Guid.Parse("7a1f0d3c-9b2e-4c5a-8d6f-0123456789ab");
        var query = new GetAuctionByIdQuery(auctionId);

        Assert.Equal($"auctions:detail:v1:{auctionId}", query.CacheKey);
    }

    [Fact]
    public void GetAuctionByIdQuery_ShouldUseDetailTtl()
    {
        var query = new GetAuctionByIdQuery(Guid.NewGuid());

        Assert.Equal(TimeSpan.FromSeconds(4), query.GetTtl(Options));
    }

    [Fact]
    public void GetAuctionBidsQuery_ShouldBuildBidsCacheKey()
    {
        var auctionId = Guid.Parse("7a1f0d3c-9b2e-4c5a-8d6f-0123456789ab");
        var query = new GetAuctionBidsQuery(auctionId);

        Assert.Equal($"auctions:bids:v1:{auctionId}", query.CacheKey);
    }

    [Fact]
    public void GetAuctionBidsQuery_ShouldUseBidsTtl()
    {
        var query = new GetAuctionBidsQuery(Guid.NewGuid());

        Assert.Equal(TimeSpan.FromSeconds(5), query.GetTtl(Options));
    }
}

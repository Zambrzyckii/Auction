using AuctionServer.Modules.Auctions.Application.Queries.GetAuctionBids;
using AuctionServer.Modules.Auctions.Domain.Entities;
using AuctionServer.Modules.Auctions.Domain.Exceptions;
using AuctionServer.Modules.Auctions.Infrastructure.Persistence;

namespace AuctionServer.Modules.Auctions.Tests.IntegrationTests;

[Collection(AuctionsIntegrationCollection.Name)]
public class GetAuctionBidsQueryHandlerTests(AuctionsPostgresFixture fixture)
{
    private async Task<List<AuctionBidQueryDto>> HandleAsync(Guid publicAuctionId)
    {
        var handler = new GetAuctionBidsQueryHandler(new SqlConnectionFactory(fixture.ConnectionString));
        return await handler.Handle(new GetAuctionBidsQuery(publicAuctionId), CancellationToken.None);
    }

    private async Task SeedBidAsync(Guid publicAuctionId, Guid bidderId, decimal amount)
    {
        await using var context = fixture.CreateContext();
        context.Bids.Add(new Bid { PublicAuctionId = publicAuctionId, BidderUserId = bidderId, Amount = amount });
        await context.SaveChangesAsync();
    }

    [Fact]
    public async Task Handle_WhenBidsExist_ShouldReturnThemNewestFirst()
    {
        var seeded = await fixture.SeedAuctionAsync(activate: true);
        var firstBidderId = Guid.NewGuid();
        var secondBidderId = Guid.NewGuid();
        await SeedBidAsync(seeded.PublicAuctionId, firstBidderId, 100m);
        await SeedBidAsync(seeded.PublicAuctionId, secondBidderId, 150m);

        var bids = await HandleAsync(seeded.PublicAuctionId);

        Assert.Equal(2, bids.Count);
        Assert.Equal(secondBidderId, bids[0].BidderUserId);
        Assert.Equal(150m, bids[0].Amount);
        Assert.Equal(firstBidderId, bids[1].BidderUserId);
        Assert.Equal(100m, bids[1].Amount);
    }

    [Fact]
    public async Task Handle_WhenAuctionHasNoBids_ShouldReturnEmptyList()
    {
        var seeded = await fixture.SeedAuctionAsync(activate: true);

        var bids = await HandleAsync(seeded.PublicAuctionId);

        Assert.Empty(bids);
    }

    [Fact]
    public async Task Handle_WhenAuctionDoesNotExist_ShouldThrowNotFound()
    {
        await Assert.ThrowsAsync<AuctionExceptions.AuctionNotFoundException>(() => HandleAsync(Guid.NewGuid()));
    }

    [Fact]
    public async Task Handle_ShouldNotReturnBidsOfOtherAuctions()
    {
        var seeded = await fixture.SeedAuctionAsync(activate: true);
        var other = await fixture.SeedAuctionAsync(activate: true);
        await SeedBidAsync(other.PublicAuctionId, Guid.NewGuid(), 100m);

        var bids = await HandleAsync(seeded.PublicAuctionId);

        Assert.Empty(bids);
    }
}

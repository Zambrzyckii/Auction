using AuctionServer.Modules.Auctions.Application.Queries.GetMyAuctions;
using AuctionServer.Modules.Auctions.Domain.Enums;
using AuctionServer.Modules.Auctions.Infrastructure.Persistence;

namespace AuctionServer.Modules.Auctions.Tests.IntegrationTests;

[Collection(AuctionsIntegrationCollection.Name)]
public class GetMyAuctionsQueryHandlerTests(AuctionsPostgresFixture fixture)
{
    private async Task<List<MyAuctionQueryDto>> HandleAsync(Guid sellerUserId)
    {
        var handler = new GetMyAuctionsQueryHandler(new SqlConnectionFactory(fixture.ConnectionString));
        return await handler.Handle(new GetMyAuctionsQuery(sellerUserId), CancellationToken.None);
    }

    [Fact]
    public async Task Handle_ShouldReturnOnlyAuctionsOfTheSeller()
    {
        var seller = Guid.NewGuid();
        var own = await fixture.SeedAuctionAsync(sellerId: seller, activate: true);
        var foreign = await fixture.SeedAuctionAsync(activate: true);

        var result = await HandleAsync(seller);

        Assert.Single(result, a => a.PublicAuctionId == own.PublicAuctionId);
        Assert.DoesNotContain(result, a => a.PublicAuctionId == foreign.PublicAuctionId);
        Assert.All(result, a => Assert.Equal(seller, a.SellerUserId));
    }

    [Fact]
    public async Task Handle_ShouldIncludeEveryStatusWithCancellationReason()
    {
        var seller = Guid.NewGuid();
        var pending = await fixture.SeedAuctionAsync(sellerId: seller);
        var active = await fixture.SeedAuctionAsync(sellerId: seller, activate: true);
        var cancelled = await fixture.SeedAuctionAsync(sellerId: seller);
        await fixture.CancelAuctionAsync(cancelled.PublicAuctionId, "Item is locked for another auction");

        var result = await HandleAsync(seller);

        Assert.Equal(AuctionStatus.Pending, Assert.Single(result, a => a.PublicAuctionId == pending.PublicAuctionId).Status);
        Assert.Equal(AuctionStatus.Active, Assert.Single(result, a => a.PublicAuctionId == active.PublicAuctionId).Status);
        var cancelledDto = Assert.Single(result, a => a.PublicAuctionId == cancelled.PublicAuctionId);
        Assert.Equal(AuctionStatus.Cancelled, cancelledDto.Status);
        Assert.Equal("Item is locked for another auction", cancelledDto.CancellationReason);
    }

    [Fact]
    public async Task Handle_ShouldOrderNewestFirst()
    {
        var seller = Guid.NewGuid();
        var older = await fixture.SeedAuctionAsync(sellerId: seller);
        var newer = await fixture.SeedAuctionAsync(sellerId: seller);

        var result = await HandleAsync(seller);

        Assert.Equal(new[] { newer.PublicAuctionId, older.PublicAuctionId }, result.Select(a => a.PublicAuctionId).ToArray());
    }

    [Fact]
    public async Task Handle_ShouldExposeCreatedOnAndItemSnapshot()
    {
        var seller = Guid.NewGuid();
        var auction = await fixture.SeedAuctionAsync(sellerId: seller, activate: true);

        var dto = Assert.Single(await HandleAsync(seller));

        Assert.Equal(auction.CreatedOn, dto.CreatedOn, TimeSpan.FromMilliseconds(1));
        Assert.Equal(auction.EndsOn, dto.EndsOn, TimeSpan.FromMilliseconds(1));
        Assert.Null(dto.CurrentWinningUserId);
        Assert.Equal(10m, dto.CurrentPrice);
        Assert.Equal("Seeded Item", dto.ItemName);
        Assert.Equal("Common", dto.ItemRarity);
        Assert.Equal(50m, dto.ItemOfficialPrice);
    }

    [Fact]
    public async Task Handle_ShouldCapTheListAtFiftyRows()
    {
        var seller = Guid.NewGuid();
        for (var i = 0; i < 51; i++) await fixture.SeedAuctionAsync(sellerId: seller);

        var result = await HandleAsync(seller);

        Assert.Equal(50, result.Count);
    }
}

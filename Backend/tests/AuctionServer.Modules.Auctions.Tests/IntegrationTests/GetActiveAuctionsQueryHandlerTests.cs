using AuctionServer.Modules.Auctions.Application.Queries.GetActiveAuctions;
using AuctionServer.Modules.Auctions.Domain.Enums;
using AuctionServer.Modules.Auctions.Infrastructure.Persistence;

namespace AuctionServer.Modules.Auctions.Tests.IntegrationTests;

[Collection(AuctionsIntegrationCollection.Name)]
public class GetActiveAuctionsQueryHandlerTests(AuctionsPostgresFixture fixture)
{
    private async Task<List<ActiveAuctionQueryDto>> HandleAsync(int limit)
    {
        var handler = new GetActiveAuctionsQueryHandler(new SqlConnectionFactory(fixture.ConnectionString));
        return await handler.Handle(new GetActiveAuctionsQuery(limit), CancellationToken.None);
    }

    [Fact]
    public async Task Handle_ShouldReturnOnlyActiveAuctionsWithItemSnapshot()
    {
        var active = await fixture.SeedAuctionAsync(activate: true);
        var pending = await fixture.SeedAuctionAsync();

        var result = await HandleAsync(100);

        Assert.DoesNotContain(result, a => a.PublicAuctionId == pending.PublicAuctionId);
        Assert.All(result, a => Assert.Equal(AuctionStatus.Active, a.Status));
        var dto = Assert.Single(result, a => a.PublicAuctionId == active.PublicAuctionId);
        Assert.Equal(active.SellerUserId, dto.SellerUserId);
        Assert.Null(dto.CurrentWinningUserId);
        Assert.Equal(10m, dto.CurrentPrice);
        Assert.Equal("Seeded Item", dto.ItemName);
        Assert.Equal("Common", dto.ItemRarity);
        Assert.Equal(50m, dto.ItemOfficialPrice);
        Assert.Null(dto.CancellationReason);
    }

    [Fact]
    public async Task Handle_ShouldRespectLimit()
    {
        await fixture.SeedAuctionAsync(activate: true);
        await fixture.SeedAuctionAsync(activate: true);

        var result = await HandleAsync(1);

        Assert.Single(result);
    }

    [Fact]
    public async Task Handle_ShouldOrderByEndsOnAscending()
    {
        await fixture.SeedAuctionAsync(activate: true, endsOn: DateTime.UtcNow.AddMinutes(30));
        await fixture.SeedAuctionAsync(activate: true, endsOn: DateTime.UtcNow.AddMinutes(5));

        var result = await HandleAsync(100);

        var endsOns = result.Select(a => a.EndsOn).ToList();
        Assert.Equal(endsOns.OrderBy(e => e), endsOns);
    }
}
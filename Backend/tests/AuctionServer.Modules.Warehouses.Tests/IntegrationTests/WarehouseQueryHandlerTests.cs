using AuctionServer.Modules.Warehouses.Application.Options;
using AuctionServer.Modules.Warehouses.Application.Queries.GetWarehouseById;
using AuctionServer.Modules.Warehouses.Application.Queries.GetWarehouses;
using AuctionServer.Modules.Warehouses.Domain.Entities;
using AuctionServer.Modules.Warehouses.Domain.Enums;
using AuctionServer.Modules.Warehouses.Infrastructure.Persistence;

namespace AuctionServer.Modules.Warehouses.Tests.IntegrationTests;

[Collection(WarehousesIntegrationCollection.Name)]
public class WarehouseQueryHandlerTests(WarehousesPostgresFixture fixture)
{
    private static readonly WarehousesOptions Options = new(
        PoolSize: 3, MinPlayers: 3, MaxPlayers: 5,
        JoinCountdown: TimeSpan.FromSeconds(30), RaiseWindow: TimeSpan.FromSeconds(10), LobbyTimeout: TimeSpan.FromMinutes(10),
        Tiers: [new WarehouseTierDefinition("Small", 3, 5, 500m, [10m, 50m], [new RarityWeight("Common", 1)])],
        EstimateVariants: [new EstimateVariant(Weight: 1, MinMultiplier: 0.5m, MaxMultiplier: 1.0m)]);

    [Fact]
    public async Task GetWarehouses_ShouldListOpenWarsWithoutTotalValue()
    {
        var openWar = await fixture.SeedOpenWarAsync(Guid.NewGuid());
        var stockingWar = await fixture.SeedWarAsync();
        await using (var seedContext = fixture.CreateContext())
        {
            seedContext.StockItems.Add(new StockItem
            {
                PublicWarehouseId = openWar.PublicWarehouseId, Name = "Warehouse Common Find", Rarity = "Common", Price = 50m
            });
            await seedContext.SaveChangesAsync();
        }

        await using var context = fixture.CreateContext();
        var handler = new GetWarehousesQueryHandler(new WarehouseRepository(context), Options);
        var result = await handler.Handle(new GetWarehousesQuery(100), CancellationToken.None);

        var summary = Assert.Single(result, w => w.PublicWarehouseId == openWar.PublicWarehouseId);
        Assert.Equal("Small", summary.Tier);
        Assert.Equal(WarehouseWarStatus.Open, summary.Status);
        Assert.Equal(1, summary.ItemCount);
        Assert.Equal(1, summary.Players);
        Assert.Equal(5, summary.MaxPlayers);
        Assert.InRange(summary.EstimateMin, 200m, 600m);
        Assert.DoesNotContain(result, w => w.PublicWarehouseId == stockingWar.PublicWarehouseId);
        Assert.Null(summary.GetType().GetProperty("TotalValue"));
    }

    [Fact]
    public async Task GetWarehouseById_ShouldDescribeCallerState()
    {
        var callerId = Guid.NewGuid();
        var seeded = await fixture.SeedOpenWarAsync(callerId, Guid.NewGuid());

        await using var context = fixture.CreateContext();
        var handler = new GetWarehouseByIdQueryHandler(new WarehouseRepository(context), Options);
        var result = await handler.Handle(new GetWarehouseByIdQuery(seeded.PublicWarehouseId, callerId), CancellationToken.None);

        Assert.True(result.IsParticipant);
        Assert.Equal(ParticipantState.PendingLock, result.ParticipantState);
        Assert.False(result.IsLeader);
        Assert.Equal(2, result.Players);
    }

    [Fact]
    public async Task GetWarehouseById_WhenCallerIsStranger_ShouldHideParticipantState()
    {
        var seeded = await fixture.SeedOpenWarAsync(Guid.NewGuid());

        await using var context = fixture.CreateContext();
        var handler = new GetWarehouseByIdQueryHandler(new WarehouseRepository(context), Options);
        var result = await handler.Handle(new GetWarehouseByIdQuery(seeded.PublicWarehouseId, Guid.NewGuid()), CancellationToken.None);

        Assert.False(result.IsParticipant);
        Assert.Null(result.ParticipantState);
        Assert.False(result.IsLeader);
    }
}

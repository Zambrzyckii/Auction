using AuctionServer.Modules.Warehouses.Application.Command.PlaceWarehouseBid;
using AuctionServer.Modules.Warehouses.Application.Options;
using AuctionServer.Modules.Warehouses.Domain.Exceptions;
using AuctionServer.Modules.Warehouses.Infrastructure.Persistence;

namespace AuctionServer.Modules.Warehouses.Tests.IntegrationTests;

[Collection(WarehousesIntegrationCollection.Name)]
public class PlaceWarehouseBidCommandTests(WarehousesPostgresFixture fixture)
{
    private static readonly WarehousesOptions Options = new(
        PoolSize: 3, MinPlayers: 3, MaxPlayers: 5,
        JoinCountdown: TimeSpan.FromSeconds(30), RaiseWindow: TimeSpan.FromSeconds(10), LobbyTimeout: TimeSpan.FromMinutes(10),
        Tiers: [new WarehouseTierDefinition("Small", 3, 5, 500m, [10m, 50m, 100m], [new RarityWeight("Common", 1)])],
        EstimateVariants: [new EstimateVariant(Weight: 1, MinMultiplier: 0.5m, MaxMultiplier: 1.0m)]);

    private async Task PlaceBidAsync(Guid warehouseId, Guid userId, decimal increment)
    {
        await using var context = fixture.CreateContext();
        var handler = new PlaceWarehouseBidCommandHandler(new WarehouseRepository(context), Options);
        await handler.Handle(new PlaceWarehouseBidCommand(warehouseId, userId, increment), CancellationToken.None);
    }

    [Fact]
    public async Task Handle_ShouldRaiseWithTierIncrements()
    {
        var players = new[] { Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid() };
        var seeded = await fixture.SeedBiddingWarAsync(players);

        await PlaceBidAsync(seeded.PublicWarehouseId, players[0], 50m);
        await PlaceBidAsync(seeded.PublicWarehouseId, players[1], 100m);

        var war = await fixture.GetWarAsync(seeded.PublicWarehouseId);
        Assert.Equal(150m, war.CurrentPrice);
        Assert.Equal(players[1], war.CurrentLeaderId);
        Assert.NotNull(war.BiddingEndsOn);
        Assert.True(war.BiddingEndsOn > DateTime.UtcNow);
    }

    [Fact]
    public async Task Handle_WhenIncrementOutsideTier_ShouldThrow()
    {
        var players = new[] { Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid() };
        var seeded = await fixture.SeedBiddingWarAsync(players);

        await Assert.ThrowsAsync<WarehouseExceptions.InvalidIncrementException>(
            () => PlaceBidAsync(seeded.PublicWarehouseId, players[0], 25m));

        var war = await fixture.GetWarAsync(seeded.PublicWarehouseId);
        Assert.Equal(0m, war.CurrentPrice);
        Assert.Null(war.CurrentLeaderId);
    }

    [Fact]
    public async Task Handle_WhenLeaderRaisesAgain_ShouldThrow()
    {
        var players = new[] { Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid() };
        var seeded = await fixture.SeedBiddingWarAsync(players);
        await PlaceBidAsync(seeded.PublicWarehouseId, players[0], 50m);

        await Assert.ThrowsAsync<WarehouseExceptions.AlreadyLeadingException>(
            () => PlaceBidAsync(seeded.PublicWarehouseId, players[0], 50m));
    }
}

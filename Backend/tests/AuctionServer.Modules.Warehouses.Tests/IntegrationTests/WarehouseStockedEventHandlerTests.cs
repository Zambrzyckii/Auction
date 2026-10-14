using AuctionServer.Modules.Warehouses.Application.Handlers;
using AuctionServer.Modules.Warehouses.Application.Options;
using AuctionServer.Modules.Warehouses.Domain.Enums;
using AuctionServer.Modules.Warehouses.Infrastructure.Persistence;
using AuctionServer.Shared.Integration.Events;
using Microsoft.EntityFrameworkCore;

namespace AuctionServer.Modules.Warehouses.Tests.IntegrationTests;

[Collection(WarehousesIntegrationCollection.Name)]
public class WarehouseStockedEventHandlerTests(WarehousesPostgresFixture fixture)
{
    private static readonly WarehousesOptions Options = new(
        PoolSize: 3, MinPlayers: 3, MaxPlayers: 5,
        JoinCountdown: TimeSpan.FromSeconds(30), RaiseWindow: TimeSpan.FromSeconds(10), LobbyTimeout: TimeSpan.FromMinutes(10),
        Tiers: [new WarehouseTierDefinition("Small", 3, 5, 500m, [10m, 50m], [new RarityWeight("Common", 1)])],
        EstimateVariants: [new EstimateVariant(Weight: 1, MinMultiplier: 0.5m, MaxMultiplier: 1.0m)]);

    private static WarehouseStockedEvent CreateEvent(Guid warehouseId) =>
        new(Guid.NewGuid(), warehouseId, [
            new WarehouseStockItem("Warehouse Common Find", "Common", 50m),
            new WarehouseStockItem("Warehouse Rare Find", "Rare", 300m)
        ]);

    private async Task HandleAsync(WarehouseStockedEvent notification)
    {
        await using var context = fixture.CreateContext();
        var handler = new WarehouseStockedEventHandler(new WarehouseRepository(context), Options);
        await handler.Handle(notification, CancellationToken.None);
    }

    [Fact]
    public async Task Handle_WhenWarIsStocking_ShouldOpenLobbyWithManifest()
    {
        var seeded = await fixture.SeedWarAsync();
        var notification = CreateEvent(seeded.PublicWarehouseId);

        await HandleAsync(notification);

        var war = await fixture.GetWarAsync(seeded.PublicWarehouseId);
        Assert.Equal(WarehouseWarStatus.Open, war.Status);
        Assert.Equal(350m, war.TotalValue);
        Assert.InRange(war.EstimateMin, 160m, 360m);
        Assert.InRange(war.EstimateMax, war.EstimateMin, 360m);

        await using var context = fixture.CreateContext();
        var stock = await context.StockItems.AsNoTracking()
            .Where(s => s.PublicWarehouseId == seeded.PublicWarehouseId).ToListAsync();
        Assert.Equal(2, stock.Count);
        Assert.Contains(stock, s => s.Rarity == "Rare" && s.Price == 300m);
        Assert.True(await context.ProcessedMessages.AnyAsync(m => m.EventId == notification.EventId));
    }

    [Fact]
    public async Task Handle_WhenEventIsDeliveredTwice_ShouldStoreManifestOnce()
    {
        var seeded = await fixture.SeedWarAsync();
        var notification = CreateEvent(seeded.PublicWarehouseId);

        await HandleAsync(notification);
        await HandleAsync(notification);

        await using var context = fixture.CreateContext();
        var stockCount = await context.StockItems.CountAsync(s => s.PublicWarehouseId == seeded.PublicWarehouseId);
        Assert.Equal(2, stockCount);
    }
}

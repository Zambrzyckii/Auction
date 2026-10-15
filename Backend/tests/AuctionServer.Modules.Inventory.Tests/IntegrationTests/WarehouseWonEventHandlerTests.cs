using AuctionServer.Modules.Inventory.Application.Handlers;
using AuctionServer.Modules.Inventory.Domain.Enums;
using AuctionServer.Modules.Inventory.Infrastructure.Persistence;
using AuctionServer.Shared.Integration.Events.Warehouses;
using Microsoft.EntityFrameworkCore;

namespace AuctionServer.Modules.Inventory.Tests.IntegrationTests;

[Collection(InventoryIntegrationCollection.Name)]
public class WarehouseWonEventHandlerTests(InventoryPostgresFixture fixture)
{
    private static WarehouseWonEvent CreateEvent(Guid winnerId) =>
        new(Guid.NewGuid(), Guid.NewGuid(), winnerId, 350m, [
            new WarehouseStockItem("Warehouse Common Find", "Common", 50m),
            new WarehouseStockItem("Warehouse Rare Find", "Rare", 300m)
        ]);

    private async Task HandleAsync(WarehouseWonEvent notification)
    {
        await using var context = fixture.CreateContext();
        var handler = new WarehouseWonEventHandler(new ItemRepository(context));
        await handler.Handle(notification, CancellationToken.None);
    }

    [Fact]
    public async Task Handle_ShouldMintManifestForWinner()
    {
        var winnerId = Guid.NewGuid();
        var notification = CreateEvent(winnerId);

        await HandleAsync(notification);

        await using var context = fixture.CreateContext();
        var items = await context.Items.AsNoTracking()
            .Where(i => i.OwnerUserId == winnerId).ToListAsync();
        Assert.Equal(2, items.Count);
        var rare = Assert.Single(items, i => i.Rarity == ItemRarity.Rare);
        Assert.Equal("Warehouse Rare Find", rare.Name);
        Assert.Equal(300m, rare.OfficialPrice);
        Assert.All(items, i => Assert.Equal(ItemStatus.Available, i.Status));
        Assert.True(await context.ProcessedMessages.AnyAsync(m => m.EventId == notification.EventId));
    }

    [Fact]
    public async Task Handle_WhenEventIsDeliveredTwice_ShouldMintOnce()
    {
        var winnerId = Guid.NewGuid();
        var notification = CreateEvent(winnerId);

        await HandleAsync(notification);
        await HandleAsync(notification);

        await using var context = fixture.CreateContext();
        Assert.Equal(2, await context.Items.CountAsync(i => i.OwnerUserId == winnerId));
    }
}

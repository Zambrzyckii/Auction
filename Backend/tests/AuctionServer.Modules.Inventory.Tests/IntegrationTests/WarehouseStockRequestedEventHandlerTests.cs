using System.Text.Json;
using AuctionServer.Modules.Inventory.Application.Handlers;
using AuctionServer.Modules.Inventory.Infrastructure.Persistence;
using AuctionServer.Shared.Integration.Events.Warehouses;
using Microsoft.EntityFrameworkCore;

namespace AuctionServer.Modules.Inventory.Tests.IntegrationTests;

[Collection(InventoryIntegrationCollection.Name)]
public class WarehouseStockRequestedEventHandlerTests(InventoryPostgresFixture fixture)
{
    private static WarehouseStockRequestedEvent CreateEvent(Guid warehouseId) =>
        new(Guid.NewGuid(), warehouseId, ["Common", "Rare"]);

    private async Task HandleAsync(WarehouseStockRequestedEvent notification)
    {
        await using var context = fixture.CreateContext();
        var handler = new WarehouseStockRequestedEventHandler(new ItemRepository(context));
        await handler.Handle(notification, CancellationToken.None);
    }

    [Fact]
    public async Task Handle_ShouldQuoteStockWithoutMintingItems()
    {
        var warehouseId = Guid.NewGuid();
        var notification = CreateEvent(warehouseId);

        await HandleAsync(notification);

        await using var context = fixture.CreateContext();
        var outboxMessage = await context.OutboxMessages
            .SingleAsync(m => m.Type == nameof(WarehouseStockedEvent) && m.Content.Contains(warehouseId.ToString()));
        var stocked = JsonSerializer.Deserialize<WarehouseStockedEvent>(outboxMessage.Content);
        Assert.NotNull(stocked);
        Assert.Equal(outboxMessage.Id, stocked.EventId);
        Assert.Equal(2, stocked.Stock.Count);
        var common = Assert.Single(stocked.Stock, s => s.Rarity == "Common");
        var rare = Assert.Single(stocked.Stock, s => s.Rarity == "Rare");
        Assert.InRange(common.Price, 10m, 99m);
        Assert.InRange(rare.Price, 100m, 999m);
        Assert.False(await context.Items.AnyAsync(i => i.OwnerUserId == Guid.Empty));
        Assert.True(await context.ProcessedMessages.AnyAsync(m => m.EventId == notification.EventId));
    }

    [Fact]
    public async Task Handle_WhenEventIsDeliveredTwice_ShouldStoreSingleReply()
    {
        var warehouseId = Guid.NewGuid();
        var notification = CreateEvent(warehouseId);

        await HandleAsync(notification);
        await HandleAsync(notification);

        await using var context = fixture.CreateContext();
        var replies = await context.OutboxMessages
            .CountAsync(m => m.Type == nameof(WarehouseStockedEvent) && m.Content.Contains(warehouseId.ToString()));
        Assert.Equal(1, replies);
    }
}

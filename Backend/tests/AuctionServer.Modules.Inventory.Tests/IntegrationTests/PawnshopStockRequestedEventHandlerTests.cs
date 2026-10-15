using System.Text.Json;
using AuctionServer.Modules.Inventory.Application.Handlers;
using AuctionServer.Modules.Inventory.Infrastructure.Persistence;
using AuctionServer.Shared.Integration.Events.Pawnshop;
using Microsoft.EntityFrameworkCore;

namespace AuctionServer.Modules.Inventory.Tests.IntegrationTests;

[Collection(InventoryIntegrationCollection.Name)]
public class PawnshopStockRequestedEventHandlerTests(InventoryPostgresFixture fixture)
{
    private async Task HandleAsync(PawnshopStockRequestedEvent notification)
    {
        await using var context = fixture.CreateContext();
        var handler = new PawnshopStockRequestedEventHandler(new ItemRepository(context));
        await handler.Handle(notification, CancellationToken.None);
    }

    [Theory]
    [InlineData("Common", 10, 99)]
    [InlineData("Rare", 100, 999)]
    [InlineData("Epic", 1000, 9999)]
    [InlineData("Legendary", 10000, 99999)]
    public async Task Handle_ShouldQuoteStockWithinRarityBand(string rarity, int min, int max)
    {
        var pawnshopId = Guid.NewGuid();
        var notification = new PawnshopStockRequestedEvent(Guid.NewGuid(), pawnshopId, [rarity]);

        await HandleAsync(notification);

        await using var context = fixture.CreateContext();
        var outboxMessage = await context.OutboxMessages
            .SingleAsync(m => m.Type == nameof(PawnshopStockedEvent) && m.Content.Contains(pawnshopId.ToString()));
        var stocked = JsonSerializer.Deserialize<PawnshopStockedEvent>(outboxMessage.Content);
        Assert.NotNull(stocked);
        var item = Assert.Single(stocked.Stock);
        Assert.Equal(rarity, item.Rarity);
        Assert.Equal($"Pawned {rarity} Good", item.Name);
        Assert.InRange(item.Price, min, max);
    }

    [Fact]
    public async Task Handle_ShouldEchoRequestIdWithoutMintingItems()
    {
        var pawnshopId = Guid.NewGuid();
        var notification = new PawnshopStockRequestedEvent(Guid.NewGuid(), pawnshopId, ["Common"]);

        await HandleAsync(notification);

        await using var context = fixture.CreateContext();
        var outboxMessage = await context.OutboxMessages
            .SingleAsync(m => m.Type == nameof(PawnshopStockedEvent) && m.Content.Contains(pawnshopId.ToString()));
        var stocked = JsonSerializer.Deserialize<PawnshopStockedEvent>(outboxMessage.Content);
        Assert.NotNull(stocked);
        Assert.Equal(outboxMessage.Id, stocked.EventId);
        Assert.Equal(notification.EventId, stocked.RequestId);
        Assert.Equal(pawnshopId, stocked.PublicPawnshopId);
        Assert.False(await context.Items.AnyAsync(i => i.OwnerUserId == Guid.Empty));
        Assert.True(await context.ProcessedMessages.AnyAsync(m => m.EventId == notification.EventId));
    }

    [Fact]
    public async Task Handle_WhenDeliveredTwice_ShouldStoreSingleReply()
    {
        var pawnshopId = Guid.NewGuid();
        var notification = new PawnshopStockRequestedEvent(Guid.NewGuid(), pawnshopId, ["Common"]);

        await HandleAsync(notification);
        await HandleAsync(notification);

        await using var context = fixture.CreateContext();
        var replies = await context.OutboxMessages
            .CountAsync(m => m.Type == nameof(PawnshopStockedEvent) && m.Content.Contains(pawnshopId.ToString()));
        Assert.Equal(1, replies);
    }
}

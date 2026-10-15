using AuctionServer.Modules.Pawnshop.Application.Handlers;
using AuctionServer.Modules.Pawnshop.Application.Options;
using AuctionServer.Modules.Pawnshop.Domain.Enums;
using AuctionServer.Modules.Pawnshop.Domain.Exceptions;
using AuctionServer.Modules.Pawnshop.Infrastructure.Persistence;
using AuctionServer.Shared.Integration.Events.Pawnshop;
using Microsoft.EntityFrameworkCore;

namespace AuctionServer.Modules.Pawnshop.Tests.IntegrationTests;

[Collection(PawnshopIntegrationCollection.Name)]
public class PawnshopStockedEventHandlerTests(PawnshopPostgresFixture fixture)
{
    private static readonly PawnshopOptions Options = new(100000m, 1000000m, TimeSpan.FromMinutes(5),
        TimeSpan.FromMinutes(15), TimeSpan.FromMinutes(15),
        [new BotTierDefinition("Pawn Clerk", PawnshopRarity.Common, 50000m, TimeSpan.FromSeconds(30), 0.5m)]);

    private async Task HandleAsync(PawnshopStockedEvent notification)
    {
        await using var context = fixture.CreateContext();
        var handler = new PawnshopStockedEventHandler(new PawnshopRepository(context), Options);
        await handler.Handle(notification, CancellationToken.None);
    }

    private static PawnshopStockedEvent BuildReply(Guid publicPawnshopId, Guid requestId) =>
        new(Guid.NewGuid(), publicPawnshopId, requestId, [new PawnshopStockItem("Pawned Common Good", "Common", 55m)]);

    [Fact]
    public async Task Handle_ShouldInsertStockAndClearPendingRequest()
    {
        var seeded = await fixture.SeedShopWithBotAsync();
        var requestId = await fixture.RequestSpawnAsync(seeded.PublicPawnshopId, DateTime.UtcNow.AddMinutes(1));
        var notification = BuildReply(seeded.PublicPawnshopId, requestId);

        await HandleAsync(notification);

        await using var context = fixture.CreateContext();
        var item = await context.StockItems.SingleAsync(i => i.PublicPawnshopId == seeded.PublicPawnshopId);
        Assert.Equal(StockItemStatus.InStock, item.Status);
        Assert.Equal(seeded.UserId, item.UserId);
        Assert.Equal(55m, item.Price);
        Assert.Equal(0.5m, item.PayoutRate);
        Assert.Equal(item.SpawnedOn + TimeSpan.FromMinutes(5), item.SellAfter);

        var shop = await fixture.GetShopAsync(seeded.PublicPawnshopId);
        Assert.Null(shop.PendingStockRequestId);
        Assert.True(await context.ProcessedMessages.AnyAsync(m => m.EventId == notification.EventId));
    }

    [Fact]
    public async Task Handle_WhenDeliveredTwice_ShouldInsertOneSet()
    {
        var seeded = await fixture.SeedShopWithBotAsync();
        var requestId = await fixture.RequestSpawnAsync(seeded.PublicPawnshopId, DateTime.UtcNow.AddMinutes(1));
        var notification = BuildReply(seeded.PublicPawnshopId, requestId);

        await HandleAsync(notification);
        await HandleAsync(notification);

        await using var context = fixture.CreateContext();
        Assert.Equal(1, await context.StockItems.CountAsync(i => i.PublicPawnshopId == seeded.PublicPawnshopId));
    }

    [Fact]
    public async Task Handle_WhenRequestIdMismatched_ShouldThrowWithoutRows()
    {
        var seeded = await fixture.SeedShopWithBotAsync();
        await fixture.RequestSpawnAsync(seeded.PublicPawnshopId, DateTime.UtcNow.AddMinutes(1));
        var notification = BuildReply(seeded.PublicPawnshopId, Guid.NewGuid());

        await Assert.ThrowsAsync<PawnshopExceptions.InvalidShopStateTransitionException>(
            () => HandleAsync(notification));

        await using var context = fixture.CreateContext();
        Assert.False(await context.StockItems.AnyAsync(i => i.PublicPawnshopId == seeded.PublicPawnshopId));
        Assert.False(await context.ProcessedMessages.AnyAsync(m => m.EventId == notification.EventId));
    }
}

using AuctionServer.Modules.Inventory.Application.Handlers;
using AuctionServer.Modules.Inventory.Domain.Enums;
using AuctionServer.Modules.Inventory.Infrastructure.Persistence;
using AuctionServer.Shared.Integration.Events.Pawnshop;
using Microsoft.EntityFrameworkCore;

namespace AuctionServer.Modules.Inventory.Tests.IntegrationTests;

[Collection(InventoryIntegrationCollection.Name)]
public class PawnshopItemWithdrawnEventHandlerTests(InventoryPostgresFixture fixture)
{
    private static PawnshopItemWithdrawnEvent CreateEvent(Guid userId) =>
        new(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), userId, "Pawned Rare Good", "Rare", 437m);

    private async Task HandleAsync(PawnshopItemWithdrawnEvent notification)
    {
        await using var context = fixture.CreateContext();
        var handler = new PawnshopItemWithdrawnEventHandler(new ItemRepository(context));
        await handler.Handle(notification, CancellationToken.None);
    }

    [Fact]
    public async Task Handle_ShouldMintWithdrawnItemAtSpawnPrice()
    {
        var userId = Guid.NewGuid();
        var notification = CreateEvent(userId);

        await HandleAsync(notification);

        await using var context = fixture.CreateContext();
        var item = await context.Items.AsNoTracking().SingleAsync(i => i.OwnerUserId == userId);
        Assert.Equal("Pawned Rare Good", item.Name);
        Assert.Equal(ItemRarity.Rare, item.Rarity);
        Assert.Equal(437m, item.OfficialPrice);
        Assert.Equal(ItemStatus.Available, item.Status);
        Assert.True(await context.ProcessedMessages.AnyAsync(m => m.EventId == notification.EventId));
    }

    [Fact]
    public async Task Handle_WhenEventIsDeliveredTwice_ShouldMintOnce()
    {
        var userId = Guid.NewGuid();
        var notification = CreateEvent(userId);

        await HandleAsync(notification);
        await HandleAsync(notification);

        await using var context = fixture.CreateContext();
        Assert.Equal(1, await context.Items.CountAsync(i => i.OwnerUserId == userId));
    }
}

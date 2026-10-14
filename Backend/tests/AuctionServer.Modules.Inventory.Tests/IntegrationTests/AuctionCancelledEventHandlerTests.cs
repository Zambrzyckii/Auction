using AuctionServer.Modules.Inventory.Application.Handlers;
using AuctionServer.Modules.Inventory.Domain.Enums;
using AuctionServer.Modules.Inventory.Infrastructure.Persistence;
using AuctionServer.Shared.Integration.Events;
using Microsoft.EntityFrameworkCore;

namespace AuctionServer.Modules.Inventory.Tests.IntegrationTests;

[Collection(InventoryIntegrationCollection.Name)]
public class AuctionCancelledEventHandlerTests(InventoryPostgresFixture fixture)
{
    private static AuctionCancelledEvent CreateEvent(Guid auctionId, Guid itemId) =>
        new(Guid.NewGuid(), auctionId, itemId, "Activation timed out");

    private async Task HandleAsync(AuctionCancelledEvent notification)
    {
        await using var context = fixture.CreateContext();
        var handler = new AuctionCancelledEventHandler(new ItemRepository(context));
        await handler.Handle(notification, CancellationToken.None);
    }

    private async Task<bool> WasProcessedAsync(Guid eventId)
    {
        await using var context = fixture.CreateContext();
        return await context.ProcessedMessages.AnyAsync(m => m.EventId == eventId);
    }

    [Fact]
    public async Task Handle_WhenItemIsLocked_ShouldUnlockItemAndStoreInboxRow()
    {
        var auctionId = Guid.NewGuid();
        var seeded = await fixture.SeedItemAsync(Guid.NewGuid(), status: ItemStatus.LockedForAuction, lockedForAuctionId: auctionId);
        var notification = CreateEvent(auctionId, seeded.PublicItemId);

        await HandleAsync(notification);

        var item = await fixture.GetItemAsync(seeded.PublicItemId);
        Assert.Equal(ItemStatus.Available, item.Status);
        Assert.Null(item.LockedForAuctionId);
        Assert.NotEqual(seeded.Version, item.Version);
        Assert.True(await WasProcessedAsync(notification.EventId));
    }

    [Fact]
    public async Task Handle_WhenNoItemIsLockedForAuction_ShouldStillStoreInboxRow()
    {
        var seeded = await fixture.SeedItemAsync(Guid.NewGuid());
        var notification = CreateEvent(Guid.NewGuid(), seeded.PublicItemId);

        await HandleAsync(notification);

        var item = await fixture.GetItemAsync(seeded.PublicItemId);
        Assert.Equal(ItemStatus.Available, item.Status);
        Assert.Equal(seeded.Version, item.Version);
        Assert.True(await WasProcessedAsync(notification.EventId));
    }

    [Fact]
    public async Task Handle_WhenEventWasAlreadyProcessed_ShouldDoNothing()
    {
        var auctionId = Guid.NewGuid();
        var seeded = await fixture.SeedItemAsync(Guid.NewGuid(), status: ItemStatus.LockedForAuction, lockedForAuctionId: auctionId);
        var notification = CreateEvent(auctionId, seeded.PublicItemId);

        await HandleAsync(notification);
        var versionAfterFirst = (await fixture.GetItemAsync(seeded.PublicItemId)).Version;

        await HandleAsync(notification);

        var item = await fixture.GetItemAsync(seeded.PublicItemId);
        Assert.Equal(versionAfterFirst, item.Version);
    }
}

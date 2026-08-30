using AuctionServer.Modules.Inventory.Application.Handlers;
using AuctionServer.Modules.Inventory.Domain.Enums;
using AuctionServer.Modules.Inventory.Domain.Exceptions;
using AuctionServer.Modules.Inventory.Infrastructure.Persistence;
using AuctionServer.Shared.Integration.Events;
using Microsoft.EntityFrameworkCore;

namespace AuctionServer.Modules.Inventory.Tests.IntegrationTests;

[Collection(InventoryIntegrationCollection.Name)]
public class AuctionSettledEventHandlerTests(InventoryPostgresFixture fixture)
{
    private static AuctionSettledEvent CreateEvent(Guid auctionId, Guid winnerId) =>
        new(Guid.NewGuid(), auctionId, Guid.NewGuid(), winnerId, 100m);

    private async Task HandleAsync(AuctionSettledEvent notification)
    {
        await using var context = fixture.CreateContext();
        var handler = new AuctionSettledEventHandler(new ItemRepository(context));
        await handler.Handle(notification, CancellationToken.None);
    }

    private async Task<bool> WasProcessedAsync(Guid eventId)
    {
        await using var context = fixture.CreateContext();
        return await context.ProcessedMessages.AnyAsync(m => m.EventId == eventId);
    }

    [Fact]
    public async Task Handle_WhenItemIsLockedForAuction_ShouldTransferItemToWinnerAndStoreInboxRow()
    {
        var auctionId = Guid.NewGuid();
        var winnerId = Guid.NewGuid();
        var seeded = await fixture.SeedItemAsync(Guid.NewGuid(), status: ItemStatus.LockedForAuction, lockedForAuctionId: auctionId);
        var notification = CreateEvent(auctionId, winnerId);

        await HandleAsync(notification);

        var item = await fixture.GetItemAsync(seeded.PublicItemId);
        Assert.Equal(winnerId, item.OwnerUserId);
        Assert.Equal(ItemStatus.Available, item.Status);
        Assert.Null(item.LockedForAuctionId);
        Assert.NotEqual(seeded.Version, item.Version);
        Assert.True(await WasProcessedAsync(notification.EventId));
    }

    [Fact]
    public async Task Handle_WhenEventIsDeliveredTwice_ShouldTransferOnlyOnce()
    {
        var auctionId = Guid.NewGuid();
        var winnerId = Guid.NewGuid();
        var seeded = await fixture.SeedItemAsync(Guid.NewGuid(), status: ItemStatus.LockedForAuction, lockedForAuctionId: auctionId);
        var notification = CreateEvent(auctionId, winnerId);

        await HandleAsync(notification);
        var afterFirst = await fixture.GetItemAsync(seeded.PublicItemId);
        await HandleAsync(notification);
        var afterSecond = await fixture.GetItemAsync(seeded.PublicItemId);

        Assert.Equal(winnerId, afterSecond.OwnerUserId);
        Assert.Equal(afterFirst.Version, afterSecond.Version);
    }

    [Fact]
    public async Task Handle_WhenNoItemIsLockedForAuction_ShouldThrowAndStoreNothing()
    {
        var notification = CreateEvent(Guid.NewGuid(), Guid.NewGuid());

        await Assert.ThrowsAsync<InventoryException.UserOrItemDoesntExistException>(() => HandleAsync(notification));

        Assert.False(await WasProcessedAsync(notification.EventId));
    }
}
using System.Text.Json;
using AuctionServer.Modules.Inventory.Application.Handlers;
using AuctionServer.Modules.Inventory.Domain.Enums;
using AuctionServer.Modules.Inventory.Infrastructure.Outbox;
using AuctionServer.Modules.Inventory.Infrastructure.Persistence;
using AuctionServer.Shared.Integration.Events;
using Microsoft.EntityFrameworkCore;

namespace AuctionServer.Modules.Inventory.Tests.IntegrationTests;

[Collection(InventoryIntegrationCollection.Name)]
public class ItemLockRequestedEventHandlerTests(InventoryPostgresFixture fixture)
{
    private static ItemLockRequestedEvent CreateEvent(Guid sellerId, Guid publicItemId) =>
        new(Guid.NewGuid(), Guid.NewGuid(), publicItemId, sellerId);

    private async Task HandleAsync(ItemLockRequestedEvent notification)
    {
        await using var context = fixture.CreateContext();
        var handler = new ItemLockRequestedEventHandler(new ItemRepository(context));
        await handler.Handle(notification, CancellationToken.None);
    }

    private async Task<bool> WasProcessedAsync(Guid eventId)
    {
        await using var context = fixture.CreateContext();
        return await context.ProcessedMessages.AnyAsync(m => m.EventId == eventId);
    }

    private async Task<List<OutboxMessage>> FindRepliesAsync(Guid publicAuctionId)
    {
        await using var context = fixture.CreateContext();
        return await context.OutboxMessages.Where(m => m.Content.Contains(publicAuctionId.ToString())).ToListAsync();
    }

    [Fact]
    public async Task Handle_WhenItemIsAvailable_ShouldLockItemAndStoreItemLockedEventAndInboxRow()
    {
        var ownerId = Guid.NewGuid();
        var seeded = await fixture.SeedItemAsync(ownerId, ItemRarity.Rare);
        var notification = CreateEvent(ownerId, seeded.PublicItemId);

        await HandleAsync(notification);

        var item = await fixture.GetItemAsync(seeded.PublicItemId);
        Assert.Equal(ItemStatus.LockedForAuction, item.Status);
        Assert.Equal(notification.PublicAuctionId, item.LockedForAuctionId);
        Assert.True(await WasProcessedAsync(notification.EventId));

        var reply = Assert.Single(await FindRepliesAsync(notification.PublicAuctionId));
        Assert.Equal(nameof(ItemLockedEvent), reply.Type);
        var locked = JsonSerializer.Deserialize<ItemLockedEvent>(reply.Content);
        Assert.NotNull(locked);
        Assert.Equal(reply.Id, locked.EventId);
        Assert.Equal(notification.PublicAuctionId, locked.PublicAuctionId);
        Assert.Equal(seeded.PublicItemId, locked.PublicItemId);
        Assert.Equal("Seeded Item", locked.ItemName);
        Assert.Equal("Rare", locked.ItemRarity);
        Assert.Equal(seeded.OfficialPrice, locked.OfficialPrice);
    }

    [Fact]
    public async Task Handle_WhenItemBelongsToAnotherUser_ShouldStoreItemLockRejectedEvent()
    {
        var seeded = await fixture.SeedItemAsync(Guid.NewGuid());
        var notification = CreateEvent(Guid.NewGuid(), seeded.PublicItemId);

        await HandleAsync(notification);

        var item = await fixture.GetItemAsync(seeded.PublicItemId);
        Assert.Equal(ItemStatus.Available, item.Status);
        Assert.True(await WasProcessedAsync(notification.EventId));

        var reply = Assert.Single(await FindRepliesAsync(notification.PublicAuctionId));
        Assert.Equal(nameof(ItemLockRejectedEvent), reply.Type);
        var rejected = JsonSerializer.Deserialize<ItemLockRejectedEvent>(reply.Content);
        Assert.NotNull(rejected);
        Assert.Equal(reply.Id, rejected.EventId);
        Assert.Equal(seeded.PublicItemId, rejected.PublicItemId);
        Assert.Equal("User or item with provided id doesn't exist", rejected.Reason);
    }

    [Fact]
    public async Task Handle_WhenItemIsAlreadyLocked_ShouldStoreItemLockRejectedEventAndKeepExistingLock()
    {
        var ownerId = Guid.NewGuid();
        var otherAuctionId = Guid.NewGuid();
        var seeded = await fixture.SeedItemAsync(ownerId, status: ItemStatus.LockedForAuction, lockedForAuctionId: otherAuctionId);
        var notification = CreateEvent(ownerId, seeded.PublicItemId);

        await HandleAsync(notification);

        var item = await fixture.GetItemAsync(seeded.PublicItemId);
        Assert.Equal(otherAuctionId, item.LockedForAuctionId);

        var reply = Assert.Single(await FindRepliesAsync(notification.PublicAuctionId));
        Assert.Equal(nameof(ItemLockRejectedEvent), reply.Type);
        var rejected = JsonSerializer.Deserialize<ItemLockRejectedEvent>(reply.Content);
        Assert.NotNull(rejected);
        Assert.Contains(nameof(ItemStatus.LockedForAuction), rejected.Reason);
    }

    [Fact]
    public async Task Handle_WhenEventIsDeliveredTwice_ShouldLockOnceAndStoreSingleReply()
    {
        var ownerId = Guid.NewGuid();
        var seeded = await fixture.SeedItemAsync(ownerId);
        var notification = CreateEvent(ownerId, seeded.PublicItemId);

        await HandleAsync(notification);
        await HandleAsync(notification);

        var item = await fixture.GetItemAsync(seeded.PublicItemId);
        Assert.Equal(ItemStatus.LockedForAuction, item.Status);
        Assert.Single(await FindRepliesAsync(notification.PublicAuctionId));
    }
}
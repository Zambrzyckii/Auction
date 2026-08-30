using System.Text.Json;
using AuctionServer.Modules.Auctions.Application.Handlers;
using AuctionServer.Modules.Auctions.Domain.Entities;
using AuctionServer.Modules.Auctions.Domain.Enums;
using AuctionServer.Modules.Auctions.Domain.Exceptions;
using AuctionServer.Modules.Auctions.Infrastructure.Persistence;
using AuctionServer.Shared.Integration.Events;
using Microsoft.EntityFrameworkCore;

namespace AuctionServer.Modules.Auctions.Tests.IntegrationTests;

[Collection(AuctionsIntegrationCollection.Name)]
public class ItemLockedEventHandlerTests(AuctionsPostgresFixture fixture)
{
    private static ItemLockedEvent CreateEvent(Auction auction) =>
        new(Guid.NewGuid(), auction.PublicAuctionId, auction.ItemId, "Locked Item", "Rare", 250m);

    private async Task HandleAsync(ItemLockedEvent notification)
    {
        await using var context = fixture.CreateContext();
        var handler = new ItemLockedEventHandler(new AuctionRepository(context));
        await handler.Handle(notification, CancellationToken.None);
    }

    private async Task<bool> WasProcessedAsync(Guid eventId)
    {
        await using var context = fixture.CreateContext();
        return await context.ProcessedMessages.AnyAsync(m => m.EventId == eventId);
    }

    private async Task<int> CountActivatedEventsAsync(Guid publicAuctionId)
    {
        await using var context = fixture.CreateContext();
        return await context.OutboxMessages
            .CountAsync(m => m.Type == nameof(AuctionActivatedEvent) && m.Content.Contains(publicAuctionId.ToString()));
    }

    [Fact]
    public async Task Handle_WhenAuctionIsPending_ShouldActivateWithSnapshotAndStoreActivatedEventAndInboxRow()
    {
        var seeded = await fixture.SeedAuctionAsync();
        var notification = CreateEvent(seeded);

        await HandleAsync(notification);

        var auction = await fixture.GetAuctionAsync(seeded.PublicAuctionId);
        Assert.Equal(AuctionStatus.Active, auction.Status);
        Assert.Equal("Locked Item", auction.ItemName);
        Assert.Equal("Rare", auction.ItemRarity);
        Assert.Equal(250m, auction.ItemOfficialPrice);
        Assert.NotEqual(seeded.Version, auction.Version);
        Assert.True(await WasProcessedAsync(notification.EventId));

        await using var context = fixture.CreateContext();
        var outboxMessage = await context.OutboxMessages
            .SingleAsync(m => m.Type == nameof(AuctionActivatedEvent) && m.Content.Contains(seeded.PublicAuctionId.ToString()));
        var activated = JsonSerializer.Deserialize<AuctionActivatedEvent>(outboxMessage.Content);
        Assert.NotNull(activated);
        Assert.Equal(outboxMessage.Id, activated.EventId);
        Assert.Equal(seeded.PublicAuctionId, activated.PublicAuctionId);
        Assert.Equal(seeded.SellerUserId, activated.SellerUserId);
        Assert.Equal(seeded.ItemId, activated.PublicItemId);
        Assert.Equal("Locked Item", activated.ItemName);
        Assert.Equal("Rare", activated.ItemRarity);
        Assert.Equal(250m, activated.ItemOfficialPrice);
        Assert.Equal(10m, activated.CurrentPrice);
    }

    [Fact]
    public async Task Handle_WhenEventIsDeliveredTwice_ShouldActivateOnceAndStoreSingleOutboxRow()
    {
        var seeded = await fixture.SeedAuctionAsync();
        var notification = CreateEvent(seeded);

        await HandleAsync(notification);
        var afterFirst = await fixture.GetAuctionAsync(seeded.PublicAuctionId);
        await HandleAsync(notification);
        var afterSecond = await fixture.GetAuctionAsync(seeded.PublicAuctionId);

        Assert.Equal(afterFirst.Version, afterSecond.Version);
        Assert.Equal(1, await CountActivatedEventsAsync(seeded.PublicAuctionId));
    }

    [Fact]
    public async Task Handle_WhenAuctionIsAlreadyActive_ShouldThrowAndStoreNothing()
    {
        var seeded = await fixture.SeedAuctionAsync(activate: true);
        var notification = CreateEvent(seeded);

        await Assert.ThrowsAsync<AuctionExceptions.InvalidAuctionStateTransitionException>(() => HandleAsync(notification));

        Assert.False(await WasProcessedAsync(notification.EventId));
        Assert.Equal(0, await CountActivatedEventsAsync(seeded.PublicAuctionId));
    }

    [Fact]
    public async Task Handle_WhenAuctionDoesNotExist_ShouldThrowNotFound()
    {
        var notification = new ItemLockedEvent(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), "Ghost", "Common", 1m);

        await Assert.ThrowsAsync<AuctionExceptions.AuctionNotFoundException>(() => HandleAsync(notification));
    }
}
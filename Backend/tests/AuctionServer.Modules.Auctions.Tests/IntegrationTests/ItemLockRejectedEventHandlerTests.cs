using AuctionServer.Modules.Auctions.Application.Handlers;
using AuctionServer.Modules.Auctions.Domain.Entities;
using AuctionServer.Modules.Auctions.Domain.Enums;
using AuctionServer.Modules.Auctions.Domain.Exceptions;
using AuctionServer.Modules.Auctions.Infrastructure.Persistence;
using AuctionServer.Shared.Integration.Events;
using Microsoft.EntityFrameworkCore;

namespace AuctionServer.Modules.Auctions.Tests.IntegrationTests;

[Collection(AuctionsIntegrationCollection.Name)]
public class ItemLockRejectedEventHandlerTests(AuctionsPostgresFixture fixture)
{
    private const string Reason = "Item is not available, current status: LockedForAuction";

    private static ItemLockRejectedEvent CreateEvent(Auction auction) =>
        new(Guid.NewGuid(), auction.PublicAuctionId, auction.ItemId, Reason);

    private async Task HandleAsync(ItemLockRejectedEvent notification)
    {
        await using var context = fixture.CreateContext();
        var handler = new ItemLockRejectedEventHandler(new AuctionRepository(context));
        await handler.Handle(notification, CancellationToken.None);
    }

    private async Task<bool> WasProcessedAsync(Guid eventId)
    {
        await using var context = fixture.CreateContext();
        return await context.ProcessedMessages.AnyAsync(m => m.EventId == eventId);
    }

    [Fact]
    public async Task Handle_WhenAuctionIsPending_ShouldCancelWithReasonAndStoreInboxRow()
    {
        var seeded = await fixture.SeedAuctionAsync();
        var notification = CreateEvent(seeded);

        await HandleAsync(notification);

        var auction = await fixture.GetAuctionAsync(seeded.PublicAuctionId);
        Assert.Equal(AuctionStatus.Cancelled, auction.Status);
        Assert.Equal(Reason, auction.CancellationReason);
        Assert.NotEqual(seeded.Version, auction.Version);
        Assert.True(await WasProcessedAsync(notification.EventId));
    }

    [Fact]
    public async Task Handle_WhenEventIsDeliveredTwice_ShouldCancelOnce()
    {
        var seeded = await fixture.SeedAuctionAsync();
        var notification = CreateEvent(seeded);

        await HandleAsync(notification);
        var afterFirst = await fixture.GetAuctionAsync(seeded.PublicAuctionId);
        await HandleAsync(notification);
        var afterSecond = await fixture.GetAuctionAsync(seeded.PublicAuctionId);

        Assert.Equal(AuctionStatus.Cancelled, afterSecond.Status);
        Assert.Equal(afterFirst.Version, afterSecond.Version);
    }

    [Fact]
    public async Task Handle_WhenAuctionIsAlreadyActive_ShouldThrowAndStoreNothing()
    {
        var seeded = await fixture.SeedAuctionAsync(activate: true);
        var notification = CreateEvent(seeded);

        await Assert.ThrowsAsync<AuctionExceptions.InvalidAuctionStateTransitionException>(() => HandleAsync(notification));

        var auction = await fixture.GetAuctionAsync(seeded.PublicAuctionId);
        Assert.Equal(AuctionStatus.Active, auction.Status);
        Assert.False(await WasProcessedAsync(notification.EventId));
    }
}
using AuctionServer.Modules.Auctions.Application.Handlers;
using AuctionServer.Modules.Auctions.Domain.Enums;
using AuctionServer.Modules.Auctions.Infrastructure.Persistence;
using AuctionServer.Shared.Integration.Events.Auctions;
using AuctionServer.Shared.Integration.Events.Funds;
using Microsoft.EntityFrameworkCore;

namespace AuctionServer.Modules.Auctions.Tests.IntegrationTests;

[Collection(AuctionsIntegrationCollection.Name)]
public class FundsLockRejectedEventHandlerTests(AuctionsPostgresFixture fixture)
{
    private async Task<Guid> RequestBidAsync(Guid publicAuctionId, Guid bidderId, decimal amount)
    {
        var requestId = Guid.NewGuid();
        await using var context = fixture.CreateContext();
        var auction = await context.Auctions.SingleAsync(a => a.PublicAuctionId == publicAuctionId);
        auction.RequestBid(bidderId, amount, requestId);
        await context.SaveChangesAsync();
        return requestId;
    }

    private async Task HandleAsync(FundsLockRejectedEvent notification)
    {
        await using var context = fixture.CreateContext();
        var handler = new FundsLockRejectedEventHandler(new AuctionRepository(context));
        await handler.Handle(notification, CancellationToken.None);
    }

    [Fact]
    public async Task Handle_WhenBidIsPending_ShouldClearPendingAndStoreInboxRow()
    {
        var seeded = await fixture.SeedAuctionAsync(activate: true);
        var bidderId = Guid.NewGuid();
        var requestId = await RequestBidAsync(seeded.PublicAuctionId, bidderId, 100m);
        var notification = new FundsLockRejectedEvent(
            Guid.NewGuid(), seeded.PublicAuctionId, bidderId, "Not enough funds on account", requestId);

        await HandleAsync(notification);

        var auction = await fixture.GetAuctionAsync(seeded.PublicAuctionId);
        Assert.Null(auction.PendingBidderId);
        Assert.Null(auction.PendingBidAmount);
        Assert.Null(auction.PendingBidRequestId);
        Assert.Null(auction.CurrentWinningUserId);
        Assert.Equal(10m, auction.CurrentPrice);
        Assert.Equal(AuctionStatus.Active, auction.Status);

        await using var context = fixture.CreateContext();
        Assert.True(await context.ProcessedMessages.AnyAsync(m => m.EventId == notification.EventId));
        Assert.False(await context.OutboxMessages
            .AnyAsync(m => m.Type == nameof(BidPlacedEvent) && m.Content.Contains(seeded.PublicAuctionId.ToString())));
    }

    [Fact]
    public async Task Handle_WhenRequestIdDoesNotMatchPending_ShouldKeepPendingAndStoreInboxRow()
    {
        var seeded = await fixture.SeedAuctionAsync(activate: true);
        var bidderId = Guid.NewGuid();
        var requestId = await RequestBidAsync(seeded.PublicAuctionId, bidderId, 100m);
        var notification = new FundsLockRejectedEvent(
            Guid.NewGuid(), seeded.PublicAuctionId, bidderId, "Not enough funds on account", Guid.NewGuid());

        await HandleAsync(notification);

        var auction = await fixture.GetAuctionAsync(seeded.PublicAuctionId);
        Assert.Equal(bidderId, auction.PendingBidderId);
        Assert.Equal(100m, auction.PendingBidAmount);
        Assert.Equal(requestId, auction.PendingBidRequestId);

        await using var context = fixture.CreateContext();
        Assert.True(await context.ProcessedMessages.AnyAsync(m => m.EventId == notification.EventId));
    }

    [Fact]
    public async Task Handle_WhenNoBidIsPending_ShouldOnlyStoreInboxRow()
    {
        var seeded = await fixture.SeedAuctionAsync(activate: true);
        var notification = new FundsLockRejectedEvent(
            Guid.NewGuid(), seeded.PublicAuctionId, Guid.NewGuid(), "Not enough funds on account");

        await HandleAsync(notification);

        var auction = await fixture.GetAuctionAsync(seeded.PublicAuctionId);
        Assert.Null(auction.PendingBidderId);

        await using var context = fixture.CreateContext();
        Assert.True(await context.ProcessedMessages.AnyAsync(m => m.EventId == notification.EventId));
    }

    [Fact]
    public async Task Handle_WhenEventIsDeliveredTwice_ShouldNotThrow()
    {
        var seeded = await fixture.SeedAuctionAsync(activate: true);
        var bidderId = Guid.NewGuid();
        var requestId = await RequestBidAsync(seeded.PublicAuctionId, bidderId, 100m);
        var notification = new FundsLockRejectedEvent(
            Guid.NewGuid(), seeded.PublicAuctionId, bidderId, "Not enough funds on account", requestId);

        await HandleAsync(notification);
        await HandleAsync(notification);

        var auction = await fixture.GetAuctionAsync(seeded.PublicAuctionId);
        Assert.Null(auction.PendingBidderId);
    }
}

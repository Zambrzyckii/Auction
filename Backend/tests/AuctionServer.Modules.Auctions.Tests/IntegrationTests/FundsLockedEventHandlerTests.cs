using System.Text.Json;
using AuctionServer.Modules.Auctions.Application.Handlers;
using AuctionServer.Modules.Auctions.Infrastructure.Persistence;
using AuctionServer.Shared.Integration.Events.Auctions;
using AuctionServer.Shared.Integration.Events.Funds;
using Microsoft.EntityFrameworkCore;

namespace AuctionServer.Modules.Auctions.Tests.IntegrationTests;

[Collection(AuctionsIntegrationCollection.Name)]
public class FundsLockedEventHandlerTests(AuctionsPostgresFixture fixture)
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

    private async Task HandleAsync(FundsLockedEvent notification)
    {
        await using var context = fixture.CreateContext();
        var handler = new FundsLockedEventHandler(new AuctionRepository(context));
        await handler.Handle(notification, CancellationToken.None);
    }

    private async Task<List<BidPlacedEvent>> GetBidPlacedEventsAsync(Guid publicAuctionId)
    {
        await using var context = fixture.CreateContext();
        var rows = await context.OutboxMessages
            .Where(m => m.Type == nameof(BidPlacedEvent) && m.Content.Contains(publicAuctionId.ToString()))
            .ToListAsync();
        return rows.Select(r => JsonSerializer.Deserialize<BidPlacedEvent>(r.Content)!).ToList();
    }

    private async Task<List<FundsUnlockRequestedEvent>> GetUnlockEventsAsync(Guid publicAuctionId)
    {
        await using var context = fixture.CreateContext();
        var rows = await context.OutboxMessages
            .Where(m => m.Type == nameof(FundsUnlockRequestedEvent) && m.Content.Contains(publicAuctionId.ToString()))
            .ToListAsync();
        return rows.Select(r => JsonSerializer.Deserialize<FundsUnlockRequestedEvent>(r.Content)!).ToList();
    }

    [Fact]
    public async Task Handle_WhenBidIsPending_ShouldPromoteLeaderAndStoreBidPlacedEventAndInboxRow()
    {
        var seeded = await fixture.SeedAuctionAsync(activate: true);
        var bidderId = Guid.NewGuid();
        var requestId = await RequestBidAsync(seeded.PublicAuctionId, bidderId, 100m);
        var notification = new FundsLockedEvent(Guid.NewGuid(), seeded.PublicAuctionId, bidderId, 100m, requestId);

        await HandleAsync(notification);

        var auction = await fixture.GetAuctionAsync(seeded.PublicAuctionId);
        Assert.Equal(bidderId, auction.CurrentWinningUserId);
        Assert.Equal(100m, auction.CurrentPrice);
        Assert.Null(auction.PendingBidderId);
        Assert.Null(auction.PendingBidAmount);
        Assert.Null(auction.PendingBidRequestId);
        Assert.Null(auction.PendingBidRequestedOn);

        var bidPlaced = Assert.Single(await GetBidPlacedEventsAsync(seeded.PublicAuctionId));
        Assert.Equal(bidderId, bidPlaced.NewWinningUserId);
        Assert.Null(bidPlaced.PreviousWinningUserId);
        Assert.Equal(100m, bidPlaced.NewPrice);
        Assert.Null(bidPlaced.PreviousPrice);

        await using var context = fixture.CreateContext();
        Assert.True(await context.ProcessedMessages.AnyAsync(m => m.EventId == notification.EventId));
    }

    [Fact]
    public async Task Handle_WhenPreviousLeaderExists_ShouldCarryThemInBidPlacedEvent()
    {
        var seeded = await fixture.SeedAuctionAsync(activate: true);
        var firstBidderId = Guid.NewGuid();
        var secondBidderId = Guid.NewGuid();
        var firstRequestId = await RequestBidAsync(seeded.PublicAuctionId, firstBidderId, 100m);
        await HandleAsync(new FundsLockedEvent(Guid.NewGuid(), seeded.PublicAuctionId, firstBidderId, 100m, firstRequestId));
        var secondRequestId = await RequestBidAsync(seeded.PublicAuctionId, secondBidderId, 150m);

        await HandleAsync(new FundsLockedEvent(Guid.NewGuid(), seeded.PublicAuctionId, secondBidderId, 150m, secondRequestId));

        var auction = await fixture.GetAuctionAsync(seeded.PublicAuctionId);
        Assert.Equal(secondBidderId, auction.CurrentWinningUserId);
        Assert.Equal(150m, auction.CurrentPrice);

        var bidPlacedEvents = await GetBidPlacedEventsAsync(seeded.PublicAuctionId);
        var secondConfirm = Assert.Single(bidPlacedEvents, e => e.PreviousWinningUserId is not null);
        Assert.Equal(secondBidderId, secondConfirm.NewWinningUserId);
        Assert.Equal(firstBidderId, secondConfirm.PreviousWinningUserId);
        Assert.Equal(150m, secondConfirm.NewPrice);
        Assert.Equal(100m, secondConfirm.PreviousPrice);
    }

    [Fact]
    public async Task Handle_WhenAuctionWasClosedMeanwhile_ShouldClearPendingAndRequestFundsUnlock()
    {
        var seeded = await fixture.SeedAuctionAsync(activate: true);
        var bidderId = Guid.NewGuid();
        var requestId = await RequestBidAsync(seeded.PublicAuctionId, bidderId, 100m);
        await using (var context = fixture.CreateContext())
        {
            var auction = await context.Auctions.SingleAsync(a => a.PublicAuctionId == seeded.PublicAuctionId);
            auction.CloseAuction();
            await context.SaveChangesAsync();
        }
        var notification = new FundsLockedEvent(Guid.NewGuid(), seeded.PublicAuctionId, bidderId, 100m, requestId);

        await HandleAsync(notification);

        var auctionAfter = await fixture.GetAuctionAsync(seeded.PublicAuctionId);
        Assert.Null(auctionAfter.PendingBidderId);
        Assert.Null(auctionAfter.CurrentWinningUserId);
        Assert.Empty(await GetBidPlacedEventsAsync(seeded.PublicAuctionId));

        var unlock = Assert.Single(await GetUnlockEventsAsync(seeded.PublicAuctionId));
        Assert.Equal(bidderId, unlock.BidderUserId);

        await using var verifyContext = fixture.CreateContext();
        Assert.True(await verifyContext.ProcessedMessages.AnyAsync(m => m.EventId == notification.EventId));
    }

    [Fact]
    public async Task Handle_WhenRequestIdDoesNotMatchPending_ShouldRequestUnlockAndKeepPending()
    {
        var seeded = await fixture.SeedAuctionAsync(activate: true);
        var pendingBidderId = Guid.NewGuid();
        var staleBidderId = Guid.NewGuid();
        var pendingRequestId = await RequestBidAsync(seeded.PublicAuctionId, pendingBidderId, 100m);
        var notification = new FundsLockedEvent(Guid.NewGuid(), seeded.PublicAuctionId, staleBidderId, 80m, Guid.NewGuid());

        await HandleAsync(notification);

        var auction = await fixture.GetAuctionAsync(seeded.PublicAuctionId);
        Assert.Equal(pendingBidderId, auction.PendingBidderId);
        Assert.Equal(100m, auction.PendingBidAmount);
        Assert.Equal(pendingRequestId, auction.PendingBidRequestId);
        Assert.Null(auction.CurrentWinningUserId);
        Assert.Empty(await GetBidPlacedEventsAsync(seeded.PublicAuctionId));

        var unlock = Assert.Single(await GetUnlockEventsAsync(seeded.PublicAuctionId));
        Assert.Equal(staleBidderId, unlock.BidderUserId);

        await using var context = fixture.CreateContext();
        Assert.True(await context.ProcessedMessages.AnyAsync(m => m.EventId == notification.EventId));
    }

    [Fact]
    public async Task Handle_WhenNoBidIsPending_ShouldRequestUnlockInsteadOfThrowing()
    {
        var seeded = await fixture.SeedAuctionAsync(activate: true);
        var bidderId = Guid.NewGuid();
        var notification = new FundsLockedEvent(Guid.NewGuid(), seeded.PublicAuctionId, bidderId, 100m);

        await HandleAsync(notification);

        var auction = await fixture.GetAuctionAsync(seeded.PublicAuctionId);
        Assert.Null(auction.PendingBidderId);
        Assert.Null(auction.CurrentWinningUserId);
        Assert.Empty(await GetBidPlacedEventsAsync(seeded.PublicAuctionId));

        var unlock = Assert.Single(await GetUnlockEventsAsync(seeded.PublicAuctionId));
        Assert.Equal(bidderId, unlock.BidderUserId);
    }

    [Fact]
    public async Task Handle_WhenEventIsDeliveredTwice_ShouldConfirmOnceAndStoreSingleOutboxRow()
    {
        var seeded = await fixture.SeedAuctionAsync(activate: true);
        var bidderId = Guid.NewGuid();
        var requestId = await RequestBidAsync(seeded.PublicAuctionId, bidderId, 100m);
        var notification = new FundsLockedEvent(Guid.NewGuid(), seeded.PublicAuctionId, bidderId, 100m, requestId);

        await HandleAsync(notification);
        await HandleAsync(notification);

        var auction = await fixture.GetAuctionAsync(seeded.PublicAuctionId);
        Assert.Equal(bidderId, auction.CurrentWinningUserId);
        Assert.Single(await GetBidPlacedEventsAsync(seeded.PublicAuctionId));

        await using var context = fixture.CreateContext();
        Assert.Single(await context.Bids.Where(b => b.PublicAuctionId == seeded.PublicAuctionId).ToListAsync());
    }

    [Fact]
    public async Task Handle_WhenBidIsConfirmed_ShouldAppendBidHistoryRow()
    {
        var seeded = await fixture.SeedAuctionAsync(activate: true);
        var bidderId = Guid.NewGuid();
        var requestId = await RequestBidAsync(seeded.PublicAuctionId, bidderId, 100m);

        await HandleAsync(new FundsLockedEvent(Guid.NewGuid(), seeded.PublicAuctionId, bidderId, 100m, requestId));

        await using var context = fixture.CreateContext();
        var bid = await context.Bids.SingleAsync(b => b.PublicAuctionId == seeded.PublicAuctionId);
        Assert.Equal(bidderId, bid.BidderUserId);
        Assert.Equal(100m, bid.Amount);
        Assert.True(bid.PlacedOn <= DateTime.UtcNow);
    }

    [Fact]
    public async Task Handle_WhenAuctionIsNoLongerActive_ShouldNotAppendBidHistoryRow()
    {
        var seeded = await fixture.SeedAuctionAsync(activate: true);
        var bidderId = Guid.NewGuid();
        var requestId = await RequestBidAsync(seeded.PublicAuctionId, bidderId, 100m);
        await using (var context = fixture.CreateContext())
        {
            var auction = await context.Auctions.SingleAsync(a => a.PublicAuctionId == seeded.PublicAuctionId);
            auction.CloseAuction();
            await context.SaveChangesAsync();
        }

        await HandleAsync(new FundsLockedEvent(Guid.NewGuid(), seeded.PublicAuctionId, bidderId, 100m, requestId));

        await using var verifyContext = fixture.CreateContext();
        Assert.Empty(await verifyContext.Bids.Where(b => b.PublicAuctionId == seeded.PublicAuctionId).ToListAsync());
    }
}

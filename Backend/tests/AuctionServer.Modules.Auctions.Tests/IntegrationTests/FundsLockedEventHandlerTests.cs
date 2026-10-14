using System.Text.Json;
using AuctionServer.Modules.Auctions.Application.Handlers;
using AuctionServer.Modules.Auctions.Infrastructure.Persistence;
using AuctionServer.Shared.Integration.Events;
using Microsoft.EntityFrameworkCore;

namespace AuctionServer.Modules.Auctions.Tests.IntegrationTests;

[Collection(AuctionsIntegrationCollection.Name)]
public class FundsLockedEventHandlerTests(AuctionsPostgresFixture fixture)
{
    private async Task RequestBidAsync(Guid publicAuctionId, Guid bidderId, decimal amount)
    {
        await using var context = fixture.CreateContext();
        var auction = await context.Auctions.SingleAsync(a => a.PublicAuctionId == publicAuctionId);
        auction.RequestBid(bidderId, amount);
        await context.SaveChangesAsync();
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

    [Fact]
    public async Task Handle_WhenBidIsPending_ShouldPromoteLeaderAndStoreBidPlacedEventAndInboxRow()
    {
        var seeded = await fixture.SeedAuctionAsync(activate: true);
        var bidderId = Guid.NewGuid();
        await RequestBidAsync(seeded.PublicAuctionId, bidderId, 100m);
        var notification = new FundsLockedEvent(Guid.NewGuid(), seeded.PublicAuctionId, bidderId, 100m);

        await HandleAsync(notification);

        var auction = await fixture.GetAuctionAsync(seeded.PublicAuctionId);
        Assert.Equal(bidderId, auction.CurrentWinningUserId);
        Assert.Equal(100m, auction.CurrentPrice);
        Assert.Null(auction.PendingBidderId);
        Assert.Null(auction.PendingBidAmount);

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
        await RequestBidAsync(seeded.PublicAuctionId, firstBidderId, 100m);
        await HandleAsync(new FundsLockedEvent(Guid.NewGuid(), seeded.PublicAuctionId, firstBidderId, 100m));
        await RequestBidAsync(seeded.PublicAuctionId, secondBidderId, 150m);

        await HandleAsync(new FundsLockedEvent(Guid.NewGuid(), seeded.PublicAuctionId, secondBidderId, 150m));

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
        await RequestBidAsync(seeded.PublicAuctionId, bidderId, 100m);
        await using (var context = fixture.CreateContext())
        {
            var auction = await context.Auctions.SingleAsync(a => a.PublicAuctionId == seeded.PublicAuctionId);
            auction.CloseAuction();
            await context.SaveChangesAsync();
        }
        var notification = new FundsLockedEvent(Guid.NewGuid(), seeded.PublicAuctionId, bidderId, 100m);

        await HandleAsync(notification);

        var auctionAfter = await fixture.GetAuctionAsync(seeded.PublicAuctionId);
        Assert.Null(auctionAfter.PendingBidderId);
        Assert.Null(auctionAfter.CurrentWinningUserId);
        Assert.Empty(await GetBidPlacedEventsAsync(seeded.PublicAuctionId));

        await using var verifyContext = fixture.CreateContext();
        var unlockRow = await verifyContext.OutboxMessages.SingleAsync(m =>
            m.Type == nameof(FundsUnlockRequestedEvent) && m.Content.Contains(seeded.PublicAuctionId.ToString()));
        var unlock = JsonSerializer.Deserialize<FundsUnlockRequestedEvent>(unlockRow.Content);
        Assert.NotNull(unlock);
        Assert.Equal(bidderId, unlock.BidderUserId);
        Assert.True(await verifyContext.ProcessedMessages.AnyAsync(m => m.EventId == notification.EventId));
    }

    [Fact]
    public async Task Handle_WhenEventIsDeliveredTwice_ShouldConfirmOnceAndStoreSingleOutboxRow()
    {
        var seeded = await fixture.SeedAuctionAsync(activate: true);
        var bidderId = Guid.NewGuid();
        await RequestBidAsync(seeded.PublicAuctionId, bidderId, 100m);
        var notification = new FundsLockedEvent(Guid.NewGuid(), seeded.PublicAuctionId, bidderId, 100m);

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
        await RequestBidAsync(seeded.PublicAuctionId, bidderId, 100m);

        await HandleAsync(new FundsLockedEvent(Guid.NewGuid(), seeded.PublicAuctionId, bidderId, 100m));

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
        await RequestBidAsync(seeded.PublicAuctionId, bidderId, 100m);
        await using (var context = fixture.CreateContext())
        {
            var auction = await context.Auctions.SingleAsync(a => a.PublicAuctionId == seeded.PublicAuctionId);
            auction.CloseAuction();
            await context.SaveChangesAsync();
        }

        await HandleAsync(new FundsLockedEvent(Guid.NewGuid(), seeded.PublicAuctionId, bidderId, 100m));

        await using var verifyContext = fixture.CreateContext();
        Assert.Empty(await verifyContext.Bids.Where(b => b.PublicAuctionId == seeded.PublicAuctionId).ToListAsync());
    }
}

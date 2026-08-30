using System.Text.Json;
using AuctionServer.Modules.Wallets.Application.Handlers;
using AuctionServer.Modules.Wallets.Infrastructure.Persistence;
using AuctionServer.Shared.Integration.Events;
using Microsoft.EntityFrameworkCore;

namespace AuctionServer.Modules.Wallets.Tests.IntegrationTests;

[Collection(WalletsIntegrationCollection.Name)]
public class AuctionFinishedEventHandlerTests(WalletsPostgresFixture fixture)
{
    private static AuctionFinishedEvent CreateEvent(Guid winnerId, Guid sellerId, decimal finalPrice, Guid? publicAuctionId = null) =>
        new(Guid.NewGuid(), publicAuctionId ?? Guid.NewGuid(), sellerId, winnerId, finalPrice);

    private async Task HandleAsync(AuctionFinishedEvent notification)
    {
        await using var context = fixture.CreateContext();
        var handler = new AuctionFinishedEventHandler(new WalletRepository(context));
        await handler.Handle(notification, CancellationToken.None);
    }

    [Fact]
    public async Task Handle_WhenAuctionHasWinner_ShouldSettleFundsAndStoreInboxRow()
    {
        var winnerId = await fixture.SeedWalletAsync(availableFunds: 400m, lockedFunds: 100m);
        var sellerId = await fixture.SeedWalletAsync(availableFunds: 0m);
        var notification = CreateEvent(winnerId, sellerId, 100m);

        await HandleAsync(notification);

        var winner = await fixture.GetWalletAsync(winnerId);
        var seller = await fixture.GetWalletAsync(sellerId);
        Assert.Equal(400m, winner.AvailableFunds);
        Assert.Equal(0m, winner.LockedFunds);
        Assert.Equal(100m, seller.AvailableFunds);

        await using var context = fixture.CreateContext();
        Assert.True(await context.ProcessedMessages.AnyAsync(m => m.EventId == notification.EventId));
    }

    [Fact]
    public async Task Handle_WhenEventIsDeliveredTwice_ShouldSettleOnlyOnce()
    {
        var winnerId = await fixture.SeedWalletAsync(availableFunds: 400m, lockedFunds: 100m);
        var sellerId = await fixture.SeedWalletAsync(availableFunds: 0m);
        var notification = CreateEvent(winnerId, sellerId, 100m);

        await HandleAsync(notification);
        await HandleAsync(notification);

        var winner = await fixture.GetWalletAsync(winnerId);
        var seller = await fixture.GetWalletAsync(sellerId);
        Assert.Equal(400m, winner.AvailableFunds);
        Assert.Equal(0m, winner.LockedFunds);
        Assert.Equal(100m, seller.AvailableFunds);
    }

    [Fact]
    public async Task Handle_WhenAuctionHasNoWinner_ShouldChangeNothing()
    {
        var sellerId = await fixture.SeedWalletAsync(availableFunds: 50m);
        var notification = new AuctionFinishedEvent(Guid.NewGuid(), Guid.NewGuid(), sellerId, null, null);

        await HandleAsync(notification);

        var seller = await fixture.GetWalletAsync(sellerId);
        Assert.Equal(50m, seller.AvailableFunds);

        await using var context = fixture.CreateContext();
        Assert.False(await context.ProcessedMessages.AnyAsync(m => m.EventId == notification.EventId));
    }

    [Fact]
    public async Task Handle_WhenAuctionHasWinner_ShouldStoreAuctionSettledEventInOutbox()
    {
        var winnerId = await fixture.SeedWalletAsync(availableFunds: 400m, lockedFunds: 100m);
        var sellerId = await fixture.SeedWalletAsync(availableFunds: 0m);
        var auctionId = Guid.NewGuid();
        var notification = CreateEvent(winnerId, sellerId, 100m, auctionId);

        await HandleAsync(notification);

        await using var context = fixture.CreateContext();
        var outboxMessage = await context.OutboxMessages
            .SingleAsync(m => m.Type == nameof(AuctionSettledEvent) && m.Content.Contains(auctionId.ToString()));
        var settledEvent = JsonSerializer.Deserialize<AuctionSettledEvent>(outboxMessage.Content);
        Assert.NotNull(settledEvent);
        Assert.Equal(outboxMessage.Id, settledEvent.EventId);
        Assert.Equal(auctionId, settledEvent.PublicAuctionId);
        Assert.Equal(sellerId, settledEvent.SellerUserId);
        Assert.Equal(winnerId, settledEvent.WinnerUserId);
        Assert.Equal(100m, settledEvent.FinalPrice);
    }

    [Fact]
    public async Task Handle_WhenEventIsDeliveredTwice_ShouldStoreSingleOutboxRow()
    {
        var winnerId = await fixture.SeedWalletAsync(availableFunds: 400m, lockedFunds: 100m);
        var sellerId = await fixture.SeedWalletAsync(availableFunds: 0m);
        var auctionId = Guid.NewGuid();
        var notification = CreateEvent(winnerId, sellerId, 100m, auctionId);

        await HandleAsync(notification);
        await HandleAsync(notification);

        await using var context = fixture.CreateContext();
        var outboxRows = await context.OutboxMessages
            .CountAsync(m => m.Type == nameof(AuctionSettledEvent) && m.Content.Contains(auctionId.ToString()));
        Assert.Equal(1, outboxRows);
    }

    [Fact]
    public async Task Handle_WhenAuctionHasNoWinner_ShouldNotStoreOutboxRow()
    {
        var sellerId = await fixture.SeedWalletAsync(availableFunds: 50m);
        var auctionId = Guid.NewGuid();
        var notification = new AuctionFinishedEvent(Guid.NewGuid(), auctionId, sellerId, null, null);

        await HandleAsync(notification);

        await using var context = fixture.CreateContext();
        Assert.False(await context.OutboxMessages.AnyAsync(m => m.Content.Contains(auctionId.ToString())));
    }
}
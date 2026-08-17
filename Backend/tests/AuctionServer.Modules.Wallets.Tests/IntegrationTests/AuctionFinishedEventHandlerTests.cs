using AuctionServer.Modules.Wallets.Application.Handlers;
using AuctionServer.Modules.Wallets.Infrastructure.Persistence;
using AuctionServer.Shared.Integration.Events;
using Microsoft.EntityFrameworkCore;

namespace AuctionServer.Modules.Wallets.Tests.IntegrationTests;

[Collection(WalletsIntegrationCollection.Name)]
public class AuctionFinishedEventHandlerTests(WalletsPostgresFixture fixture)
{
    private static AuctionFinishedEvent CreateEvent(Guid winnerId, Guid sellerId, decimal finalPrice) =>
        new(Guid.NewGuid(), Guid.NewGuid(), sellerId, winnerId, finalPrice);

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
}

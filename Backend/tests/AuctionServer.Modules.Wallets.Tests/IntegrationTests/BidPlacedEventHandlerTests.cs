using AuctionServer.Modules.Wallets.Application.Handlers;
using AuctionServer.Modules.Wallets.Domain.Enums;
using AuctionServer.Modules.Wallets.Domain.Exceptions;
using AuctionServer.Modules.Wallets.Infrastructure.Persistence;
using AuctionServer.Shared.Integration.Events;
using Microsoft.EntityFrameworkCore;

namespace AuctionServer.Modules.Wallets.Tests.IntegrationTests;

[Collection(WalletsIntegrationCollection.Name)]
public class BidPlacedEventHandlerTests(WalletsPostgresFixture fixture)
{
    private async Task LockForAuctionAsync(Guid userId, Guid auctionId, decimal amount)
    {
        await using var context = fixture.CreateContext();
        var wallet = await context.Wallets.SingleAsync(w => w.UserId == userId);
        wallet.LockFunds(auctionId, amount);
        await context.SaveChangesAsync();
    }

    private async Task HandleAsync(BidPlacedEvent notification)
    {
        await using var context = fixture.CreateContext();
        var handler = new BidPlacedEventHandler(new WalletRepository(context));
        await handler.Handle(notification, CancellationToken.None);
    }

    [Fact]
    public async Task Handle_WhenPreviousWinnerExists_ShouldReleaseOnlyTheirLock()
    {
        var auctionId = Guid.NewGuid();
        var previousWinnerId = await fixture.SeedWalletAsync(500m);
        await LockForAuctionAsync(previousWinnerId, auctionId, 100m);
        var newWinnerId = await fixture.SeedWalletAsync(500m);
        await LockForAuctionAsync(newWinnerId, auctionId, 150m);
        var notification = new BidPlacedEvent(Guid.NewGuid(), auctionId, newWinnerId, previousWinnerId, 150m, 100m);

        await HandleAsync(notification);

        var previousWinner = await fixture.GetWalletAsync(previousWinnerId);
        Assert.Equal(500m, previousWinner.AvailableFunds);
        Assert.Equal(0m, previousWinner.LockedFunds);
        Assert.Equal(FundsLockStatus.Released, Assert.Single(previousWinner.FundsLocks).Status);

        var newWinner = await fixture.GetWalletAsync(newWinnerId);
        Assert.Equal(350m, newWinner.AvailableFunds);
        Assert.Equal(150m, newWinner.LockedFunds);
        Assert.Equal(FundsLockStatus.Active, Assert.Single(newWinner.FundsLocks).Status);
    }

    [Fact]
    public async Task Handle_WhenFirstBid_ShouldOnlyStoreInboxRow()
    {
        var auctionId = Guid.NewGuid();
        var newWinnerId = await fixture.SeedWalletAsync(500m);
        await LockForAuctionAsync(newWinnerId, auctionId, 100m);
        var notification = new BidPlacedEvent(Guid.NewGuid(), auctionId, newWinnerId, null, 100m, null);

        await HandleAsync(notification);

        var newWinner = await fixture.GetWalletAsync(newWinnerId);
        Assert.Equal(400m, newWinner.AvailableFunds);
        Assert.Equal(100m, newWinner.LockedFunds);

        await using var context = fixture.CreateContext();
        Assert.True(await context.ProcessedMessages.AnyAsync(m => m.EventId == notification.EventId));
    }

    [Fact]
    public async Task Handle_WhenEventIsDeliveredTwice_ShouldReleaseOnlyOnce()
    {
        var auctionId = Guid.NewGuid();
        var previousWinnerId = await fixture.SeedWalletAsync(500m);
        await LockForAuctionAsync(previousWinnerId, auctionId, 100m);
        var notification = new BidPlacedEvent(Guid.NewGuid(), auctionId, Guid.NewGuid(), previousWinnerId, 150m, 100m);

        await HandleAsync(notification);
        await HandleAsync(notification);

        var previousWinner = await fixture.GetWalletAsync(previousWinnerId);
        Assert.Equal(500m, previousWinner.AvailableFunds);
        Assert.Equal(0m, previousWinner.LockedFunds);
    }

    [Fact]
    public async Task Handle_WhenPreviousWinnerHasNoActiveLock_ShouldThrowLockNotFoundException()
    {
        var auctionId = Guid.NewGuid();
        var previousWinnerId = await fixture.SeedWalletAsync(500m);
        var notification = new BidPlacedEvent(Guid.NewGuid(), auctionId, Guid.NewGuid(), previousWinnerId, 150m, 100m);

        await Assert.ThrowsAsync<WalletExceptions.LockNotFoundException>(() => HandleAsync(notification));

        await using var context = fixture.CreateContext();
        Assert.False(await context.ProcessedMessages.AnyAsync(m => m.EventId == notification.EventId));
    }
}

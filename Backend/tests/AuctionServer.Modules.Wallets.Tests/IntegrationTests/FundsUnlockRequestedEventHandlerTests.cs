using AuctionServer.Modules.Wallets.Application.Handlers;
using AuctionServer.Modules.Wallets.Domain.Enums;
using AuctionServer.Modules.Wallets.Infrastructure.Persistence;
using AuctionServer.Shared.Integration.Events;
using Microsoft.EntityFrameworkCore;

namespace AuctionServer.Modules.Wallets.Tests.IntegrationTests;

[Collection(WalletsIntegrationCollection.Name)]
public class FundsUnlockRequestedEventHandlerTests(WalletsPostgresFixture fixture)
{
    private async Task HandleAsync(FundsUnlockRequestedEvent notification)
    {
        await using var context = fixture.CreateContext();
        var handler = new FundsUnlockRequestedEventHandler(new WalletRepository(context));
        await handler.Handle(notification, CancellationToken.None);
    }

    private async Task<bool> WasProcessedAsync(Guid eventId)
    {
        await using var context = fixture.CreateContext();
        return await context.ProcessedMessages.AnyAsync(m => m.EventId == eventId);
    }

    [Fact]
    public async Task Handle_WhenActiveLockExists_ShouldReleaseFundsAndStoreInboxRow()
    {
        var auctionId = Guid.NewGuid();
        var userId = await fixture.SeedWalletAsync(availableFunds: 400m, lockedFunds: 100m, lockedForAuctionId: auctionId);
        var notification = new FundsUnlockRequestedEvent(Guid.NewGuid(), auctionId, userId);

        await HandleAsync(notification);

        var wallet = await fixture.GetWalletAsync(userId);
        Assert.Equal(500m, wallet.AvailableFunds);
        Assert.Equal(0m, wallet.LockedFunds);
        Assert.Equal(FundsLockStatus.Released, Assert.Single(wallet.FundsLocks).Status);
        Assert.True(await WasProcessedAsync(notification.EventId));
    }

    [Fact]
    public async Task Handle_WhenNoActiveLock_ShouldStillStoreInboxRow()
    {
        var userId = await fixture.SeedWalletAsync(availableFunds: 500m);
        var notification = new FundsUnlockRequestedEvent(Guid.NewGuid(), Guid.NewGuid(), userId);

        await HandleAsync(notification);

        var wallet = await fixture.GetWalletAsync(userId);
        Assert.Equal(500m, wallet.AvailableFunds);
        Assert.True(await WasProcessedAsync(notification.EventId));
    }

    [Fact]
    public async Task Handle_WhenEventIsDeliveredTwice_ShouldReleaseOnlyOnce()
    {
        var auctionId = Guid.NewGuid();
        var userId = await fixture.SeedWalletAsync(availableFunds: 400m, lockedFunds: 100m, lockedForAuctionId: auctionId);
        var notification = new FundsUnlockRequestedEvent(Guid.NewGuid(), auctionId, userId);

        await HandleAsync(notification);
        await HandleAsync(notification);

        var wallet = await fixture.GetWalletAsync(userId);
        Assert.Equal(500m, wallet.AvailableFunds);
        Assert.Equal(0m, wallet.LockedFunds);
    }
}

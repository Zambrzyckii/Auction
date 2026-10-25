using System.Text.Json;
using AuctionServer.Modules.Wallets.Application.Handlers;
using AuctionServer.Modules.Wallets.Domain.Enums;
using AuctionServer.Modules.Wallets.Domain.Exceptions;
using AuctionServer.Modules.Wallets.Infrastructure.Persistence;
using AuctionServer.Shared.Integration.Events.Funds;
using Microsoft.EntityFrameworkCore;

namespace AuctionServer.Modules.Wallets.Tests.IntegrationTests;

[Collection(WalletsIntegrationCollection.Name)]
public class FundsLockRequestedEventHandlerTests(WalletsPostgresFixture fixture)
{
    private async Task HandleAsync(FundsLockRequestedEvent notification)
    {
        await using var context = fixture.CreateContext();
        var handler = new FundsLockRequestedEventHandler(new WalletRepository(context));
        await handler.Handle(notification, CancellationToken.None);
    }

    private async Task<bool> WasProcessedAsync(Guid eventId)
    {
        await using var context = fixture.CreateContext();
        return await context.ProcessedMessages.AnyAsync(m => m.EventId == eventId);
    }

    [Fact]
    public async Task Handle_WhenFundsAvailable_ShouldLockAndReplyFundsLocked()
    {
        var userId = await fixture.SeedWalletAsync(500m);
        var auctionId = Guid.NewGuid();
        var notification = new FundsLockRequestedEvent(Guid.NewGuid(), auctionId, userId, 100m);

        await HandleAsync(notification);

        var wallet = await fixture.GetWalletAsync(userId);
        Assert.Equal(400m, wallet.AvailableFunds);
        Assert.Equal(100m, wallet.LockedFunds);
        var fundsLock = Assert.Single(wallet.FundsLocks);
        Assert.Equal(auctionId, fundsLock.PublicAuctionId);
        Assert.Equal(FundsLockStatus.Active, fundsLock.Status);
        Assert.True(await WasProcessedAsync(notification.EventId));

        await using var context = fixture.CreateContext();
        var outboxMessage = await context.OutboxMessages
            .SingleAsync(m => m.Type == nameof(FundsLockedEvent) && m.Content.Contains(auctionId.ToString()));
        var locked = JsonSerializer.Deserialize<FundsLockedEvent>(outboxMessage.Content);
        Assert.NotNull(locked);
        Assert.Equal(outboxMessage.Id, locked.EventId);
        Assert.Equal(userId, locked.BidderUserId);
        Assert.Equal(100m, locked.Amount);
        Assert.Equal(notification.EventId, locked.RequestId);
    }

    [Fact]
    public async Task Handle_WhenInsufficientFunds_ShouldReplyFundsLockRejectedWithoutLocking()
    {
        var userId = await fixture.SeedWalletAsync(50m);
        var auctionId = Guid.NewGuid();
        var notification = new FundsLockRequestedEvent(Guid.NewGuid(), auctionId, userId, 100m);

        await HandleAsync(notification);

        var wallet = await fixture.GetWalletAsync(userId);
        Assert.Equal(50m, wallet.AvailableFunds);
        Assert.Equal(0m, wallet.LockedFunds);
        Assert.Empty(wallet.FundsLocks);
        Assert.True(await WasProcessedAsync(notification.EventId));

        await using var context = fixture.CreateContext();
        var outboxMessage = await context.OutboxMessages
            .SingleAsync(m => m.Type == nameof(FundsLockRejectedEvent) && m.Content.Contains(auctionId.ToString()));
        var rejected = JsonSerializer.Deserialize<FundsLockRejectedEvent>(outboxMessage.Content);
        Assert.NotNull(rejected);
        Assert.Equal(userId, rejected.BidderUserId);
        Assert.Equal("Not enough funds on account", rejected.Reason);
        Assert.Equal(notification.EventId, rejected.RequestId);
    }

    [Fact]
    public async Task Handle_WhenEventIsDeliveredTwice_ShouldLockOnceAndStoreSingleReply()
    {
        var userId = await fixture.SeedWalletAsync(500m);
        var auctionId = Guid.NewGuid();
        var notification = new FundsLockRequestedEvent(Guid.NewGuid(), auctionId, userId, 100m);

        await HandleAsync(notification);
        await HandleAsync(notification);

        var wallet = await fixture.GetWalletAsync(userId);
        Assert.Equal(400m, wallet.AvailableFunds);
        Assert.Single(wallet.FundsLocks);

        await using var context = fixture.CreateContext();
        Assert.Equal(1, await context.OutboxMessages
            .CountAsync(m => m.Type == nameof(FundsLockedEvent) && m.Content.Contains(auctionId.ToString())));
    }

    [Fact]
    public async Task Handle_WhenWalletDoesNotExist_ShouldThrowAndStoreNothing()
    {
        var notification = new FundsLockRequestedEvent(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), 100m);

        await Assert.ThrowsAsync<WalletExceptions.UserWithThisIdDontHaveWallet>(() => HandleAsync(notification));

        Assert.False(await WasProcessedAsync(notification.EventId));
    }
}

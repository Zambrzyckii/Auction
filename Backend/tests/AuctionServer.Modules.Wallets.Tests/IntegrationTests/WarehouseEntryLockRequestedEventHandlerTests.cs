using System.Text.Json;
using AuctionServer.Modules.Wallets.Application.Handlers;
using AuctionServer.Modules.Wallets.Domain.Enums;
using AuctionServer.Modules.Wallets.Infrastructure.Persistence;
using AuctionServer.Shared.Integration.Events;
using Microsoft.EntityFrameworkCore;

namespace AuctionServer.Modules.Wallets.Tests.IntegrationTests;

[Collection(WalletsIntegrationCollection.Name)]
public class WarehouseEntryLockRequestedEventHandlerTests(WalletsPostgresFixture fixture)
{
    private async Task HandleAsync(WarehouseEntryLockRequestedEvent notification)
    {
        await using var context = fixture.CreateContext();
        var handler = new WarehouseEntryLockRequestedEventHandler(new WalletRepository(context));
        await handler.Handle(notification, CancellationToken.None);
    }

    [Fact]
    public async Task Handle_WhenFundsAvailable_ShouldLockEntryFeeAndReplyLocked()
    {
        var userId = await fixture.SeedWalletAsync(500m);
        var warehouseId = Guid.NewGuid();
        var notification = new WarehouseEntryLockRequestedEvent(Guid.NewGuid(), warehouseId, userId, 500m);

        await HandleAsync(notification);

        var wallet = await fixture.GetWalletAsync(userId);
        Assert.Equal(0m, wallet.AvailableFunds);
        Assert.Equal(500m, wallet.LockedFunds);
        var fundsLock = Assert.Single(wallet.FundsLocks);
        Assert.Equal(warehouseId, fundsLock.PublicAuctionId);
        Assert.Equal(FundsLockStatus.Active, fundsLock.Status);

        await using var context = fixture.CreateContext();
        var outboxMessage = await context.OutboxMessages
            .SingleAsync(m => m.Type == nameof(WarehouseEntryLockedEvent) && m.Content.Contains(warehouseId.ToString()));
        var locked = JsonSerializer.Deserialize<WarehouseEntryLockedEvent>(outboxMessage.Content);
        Assert.NotNull(locked);
        Assert.Equal(outboxMessage.Id, locked.EventId);
        Assert.Equal(userId, locked.UserId);
        Assert.True(await context.ProcessedMessages.AnyAsync(m => m.EventId == notification.EventId));
    }

    [Fact]
    public async Task Handle_WhenInsufficientFunds_ShouldReplyRejectedWithoutLocking()
    {
        var userId = await fixture.SeedWalletAsync(100m);
        var warehouseId = Guid.NewGuid();
        var notification = new WarehouseEntryLockRequestedEvent(Guid.NewGuid(), warehouseId, userId, 500m);

        await HandleAsync(notification);

        var wallet = await fixture.GetWalletAsync(userId);
        Assert.Equal(100m, wallet.AvailableFunds);
        Assert.Empty(wallet.FundsLocks);

        await using var context = fixture.CreateContext();
        var outboxMessage = await context.OutboxMessages
            .SingleAsync(m => m.Type == nameof(WarehouseEntryLockRejectedEvent) && m.Content.Contains(warehouseId.ToString()));
        var rejected = JsonSerializer.Deserialize<WarehouseEntryLockRejectedEvent>(outboxMessage.Content);
        Assert.NotNull(rejected);
        Assert.Equal(userId, rejected.UserId);
        Assert.Equal("Not enough funds on account", rejected.Reason);
    }

    [Fact]
    public async Task Handle_WhenEventIsDeliveredTwice_ShouldLockOnceAndStoreSingleReply()
    {
        var userId = await fixture.SeedWalletAsync(500m);
        var warehouseId = Guid.NewGuid();
        var notification = new WarehouseEntryLockRequestedEvent(Guid.NewGuid(), warehouseId, userId, 500m);

        await HandleAsync(notification);
        await HandleAsync(notification);

        var wallet = await fixture.GetWalletAsync(userId);
        Assert.Equal(0m, wallet.AvailableFunds);
        Assert.Single(wallet.FundsLocks);

        await using var context = fixture.CreateContext();
        Assert.Equal(1, await context.OutboxMessages
            .CountAsync(m => m.Type == nameof(WarehouseEntryLockedEvent) && m.Content.Contains(warehouseId.ToString())));
    }
}

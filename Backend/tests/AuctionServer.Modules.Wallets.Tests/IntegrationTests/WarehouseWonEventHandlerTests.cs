using AuctionServer.Modules.Wallets.Application.Handlers;
using AuctionServer.Modules.Wallets.Domain.Enums;
using AuctionServer.Modules.Wallets.Domain.Exceptions;
using AuctionServer.Modules.Wallets.Infrastructure.Persistence;
using AuctionServer.Shared.Integration.Events;
using Microsoft.EntityFrameworkCore;

namespace AuctionServer.Modules.Wallets.Tests.IntegrationTests;

[Collection(WalletsIntegrationCollection.Name)]
public class WarehouseWonEventHandlerTests(WalletsPostgresFixture fixture)
{
    private static WarehouseWonEvent CreateEvent(Guid warehouseId, Guid winnerId, decimal finalPrice) =>
        new(Guid.NewGuid(), warehouseId, winnerId, finalPrice,
            [new WarehouseStockItem("Warehouse Common Find", "Common", 50m)]);

    private async Task HandleAsync(WarehouseWonEvent notification)
    {
        await using var context = fixture.CreateContext();
        var handler = new WarehouseWonEventHandler(new WalletRepository(context));
        await handler.Handle(notification, CancellationToken.None);
    }

    [Fact]
    public async Task Handle_ShouldSpendLockAndReturnChange()
    {
        var warehouseId = Guid.NewGuid();
        var winnerId = await fixture.SeedWalletAsync(availableFunds: 0m, lockedFunds: 500m, lockedForAuctionId: warehouseId);
        var notification = CreateEvent(warehouseId, winnerId, finalPrice: 350m);

        await HandleAsync(notification);

        var wallet = await fixture.GetWalletAsync(winnerId);
        Assert.Equal(150m, wallet.AvailableFunds);
        Assert.Equal(0m, wallet.LockedFunds);
        Assert.Equal(FundsLockStatus.Consumed, Assert.Single(wallet.FundsLocks).Status);

        await using var context = fixture.CreateContext();
        Assert.True(await context.ProcessedMessages.AnyAsync(m => m.EventId == notification.EventId));
    }

    [Fact]
    public async Task Handle_WhenEventIsDeliveredTwice_ShouldSpendOnce()
    {
        var warehouseId = Guid.NewGuid();
        var winnerId = await fixture.SeedWalletAsync(availableFunds: 0m, lockedFunds: 500m, lockedForAuctionId: warehouseId);
        var notification = CreateEvent(warehouseId, winnerId, finalPrice: 350m);

        await HandleAsync(notification);
        await HandleAsync(notification);

        var wallet = await fixture.GetWalletAsync(winnerId);
        Assert.Equal(150m, wallet.AvailableFunds);
    }

    [Fact]
    public async Task Handle_WhenLockIsMissing_ShouldThrowAndStoreNothing()
    {
        var winnerId = await fixture.SeedWalletAsync(availableFunds: 500m);
        var notification = CreateEvent(Guid.NewGuid(), winnerId, finalPrice: 350m);

        await Assert.ThrowsAsync<WalletExceptions.LockNotFoundException>(() => HandleAsync(notification));

        await using var context = fixture.CreateContext();
        Assert.False(await context.ProcessedMessages.AnyAsync(m => m.EventId == notification.EventId));
    }
}

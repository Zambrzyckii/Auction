using AuctionServer.Modules.Wallets.Domain.Entities;
using AuctionServer.Modules.Wallets.Domain.Enums;
using AuctionServer.Modules.Wallets.Domain.Exceptions;

namespace AuctionServer.Modules.Wallets.Tests.Domain.Entities;

public class WalletFundsLockTests
{
    private static Wallet CreateWalletWithFunds(decimal funds = 100m)
    {
        var wallet = new Wallet { UserId = Guid.NewGuid() };
        wallet.AddFunds(funds);
        return wallet;
    }

    [Fact]
    public void LockFunds_WhenFundsAvailable_ShouldAddActiveLockAndMoveFunds()
    {
        var wallet = CreateWalletWithFunds(100m);
        var auctionId = Guid.NewGuid();
        var versionBefore = wallet.Version;

        wallet.LockFunds(auctionId, 60m);

        var fundsLock = Assert.Single(wallet.FundsLocks);
        Assert.Equal(auctionId, fundsLock.PublicAuctionId);
        Assert.Equal(60m, fundsLock.Amount);
        Assert.Equal(FundsLockStatus.Active, fundsLock.Status);
        Assert.Equal(40m, wallet.AvailableFunds);
        Assert.Equal(60m, wallet.LockedFunds);
        Assert.NotEqual(versionBefore, wallet.Version);
    }

    [Fact]
    public void LockFunds_WhenInsufficientFunds_ShouldThrowInsufficientFundsException()
    {
        var wallet = CreateWalletWithFunds(50m);

        Assert.Throws<WalletExceptions.InsufficientFundsException>(() => wallet.LockFunds(Guid.NewGuid(), 60m));
        Assert.Empty(wallet.FundsLocks);
        Assert.Equal(50m, wallet.AvailableFunds);
    }

    [Fact]
    public void LockFunds_WhenAmountIsNotPositive_ShouldThrowInvalidAmountException()
    {
        var wallet = CreateWalletWithFunds();

        Assert.Throws<WalletExceptions.InvalidAmountException>(() => wallet.LockFunds(Guid.NewGuid(), 0m));
    }

    [Fact]
    public void LockFunds_WhenActiveLockForAuctionExists_ShouldThrowLockAlreadyExistsException()
    {
        var wallet = CreateWalletWithFunds(100m);
        var auctionId = Guid.NewGuid();
        wallet.LockFunds(auctionId, 30m);

        Assert.Throws<WalletExceptions.LockAlreadyExistsException>(() => wallet.LockFunds(auctionId, 40m));
        Assert.Equal(70m, wallet.AvailableFunds);
    }

    [Fact]
    public void ReleaseLock_ShouldReturnFundsAndKeepReleasedRow()
    {
        var wallet = CreateWalletWithFunds(100m);
        var auctionId = Guid.NewGuid();
        wallet.LockFunds(auctionId, 60m);

        wallet.ReleaseLock(auctionId);

        var fundsLock = Assert.Single(wallet.FundsLocks);
        Assert.Equal(FundsLockStatus.Released, fundsLock.Status);
        Assert.Equal(100m, wallet.AvailableFunds);
        Assert.Equal(0m, wallet.LockedFunds);
    }

    [Fact]
    public void ReleaseLock_WhenNoActiveLock_ShouldThrowLockNotFoundException()
    {
        var wallet = CreateWalletWithFunds();

        Assert.Throws<WalletExceptions.LockNotFoundException>(() => wallet.ReleaseLock(Guid.NewGuid()));
    }

    [Fact]
    public void ReleaseLock_WhenLockWasAlreadyReleased_ShouldThrowLockNotFoundException()
    {
        var wallet = CreateWalletWithFunds(100m);
        var auctionId = Guid.NewGuid();
        wallet.LockFunds(auctionId, 60m);
        wallet.ReleaseLock(auctionId);

        Assert.Throws<WalletExceptions.LockNotFoundException>(() => wallet.ReleaseLock(auctionId));
        Assert.Equal(100m, wallet.AvailableFunds);
    }

    [Fact]
    public void ConsumeLock_ShouldShrinkLockedFundsAndKeepConsumedRow()
    {
        var wallet = CreateWalletWithFunds(100m);
        var auctionId = Guid.NewGuid();
        wallet.LockFunds(auctionId, 60m);

        wallet.ConsumeLock(auctionId);

        var fundsLock = Assert.Single(wallet.FundsLocks);
        Assert.Equal(FundsLockStatus.Consumed, fundsLock.Status);
        Assert.Equal(40m, wallet.AvailableFunds);
        Assert.Equal(0m, wallet.LockedFunds);
    }

    [Fact]
    public void ConsumeLock_WhenNoActiveLock_ShouldThrowLockNotFoundException()
    {
        var wallet = CreateWalletWithFunds();

        Assert.Throws<WalletExceptions.LockNotFoundException>(() => wallet.ConsumeLock(Guid.NewGuid()));
    }

    [Fact]
    public void ReleaseLock_WhenTwoAuctionsAreLocked_ShouldOnlyTouchItsOwnLock()
    {
        var wallet = CreateWalletWithFunds(100m);
        var firstAuctionId = Guid.NewGuid();
        var secondAuctionId = Guid.NewGuid();
        wallet.LockFunds(firstAuctionId, 30m);
        wallet.LockFunds(secondAuctionId, 50m);

        wallet.ReleaseLock(firstAuctionId);

        Assert.Equal(50m, wallet.AvailableFunds);
        Assert.Equal(50m, wallet.LockedFunds);
        Assert.Equal(FundsLockStatus.Active,
            wallet.FundsLocks.Single(l => l.PublicAuctionId == secondAuctionId).Status);
    }

    [Fact]
    public void SpendLock_WhenAmountWithinLock_ShouldConsumeLockAndReturnChange()
    {
        var wallet = CreateWalletWithFunds(500m);
        var warehouseId = Guid.NewGuid();
        wallet.LockFunds(warehouseId, 500m);
        var versionBefore = wallet.Version;

        wallet.SpendLock(warehouseId, 350m);

        Assert.Equal(150m, wallet.AvailableFunds);
        Assert.Equal(0m, wallet.LockedFunds);
        Assert.Equal(FundsLockStatus.Consumed, Assert.Single(wallet.FundsLocks).Status);
        Assert.NotEqual(versionBefore, wallet.Version);
    }

    [Fact]
    public void SpendLock_WhenAmountEqualsLock_ShouldSpendWholeLock()
    {
        var wallet = CreateWalletWithFunds(500m);
        var warehouseId = Guid.NewGuid();
        wallet.LockFunds(warehouseId, 500m);

        wallet.SpendLock(warehouseId, 500m);

        Assert.Equal(0m, wallet.AvailableFunds);
        Assert.Equal(0m, wallet.LockedFunds);
    }

    [Fact]
    public void SpendLock_WhenAmountExceedsLock_ShouldThrowInvalidAmountException()
    {
        var wallet = CreateWalletWithFunds(100m);
        var warehouseId = Guid.NewGuid();
        wallet.LockFunds(warehouseId, 100m);

        Assert.Throws<WalletExceptions.InvalidAmountException>(() => wallet.SpendLock(warehouseId, 150m));
        Assert.Equal(100m, wallet.LockedFunds);
        Assert.Equal(FundsLockStatus.Active, Assert.Single(wallet.FundsLocks).Status);
    }

    [Fact]
    public void SpendLock_WhenAmountIsNotPositive_ShouldThrowInvalidAmountException()
    {
        var wallet = CreateWalletWithFunds(100m);
        var warehouseId = Guid.NewGuid();
        wallet.LockFunds(warehouseId, 100m);

        Assert.Throws<WalletExceptions.InvalidAmountException>(() => wallet.SpendLock(warehouseId, 0m));
    }

    [Fact]
    public void SpendLock_WhenLockIsMissing_ShouldThrowLockNotFoundException()
    {
        var wallet = CreateWalletWithFunds(100m);

        Assert.Throws<WalletExceptions.LockNotFoundException>(() => wallet.SpendLock(Guid.NewGuid(), 50m));
    }
}

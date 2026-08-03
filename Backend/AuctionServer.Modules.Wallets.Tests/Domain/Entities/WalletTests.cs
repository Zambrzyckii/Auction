using AuctionServer.Modules.Wallets.Domain.Entities;
using AuctionServer.Modules.Wallets.Domain.Exceptions;

namespace AuctionServer.Modules.Wallets.Tests.Domain.Entities;

public class WalletTests
{
    [Fact]
    public void AddFunds_WhenDepositIsFine_ShouldUpdateAvailableFunds()
    {
        var wallet = new Wallet { UserId = Guid.NewGuid() };
        var initialVersion = wallet.Version;
        var depositAmount = 100m;
        
        wallet.AddFunds(depositAmount);
        
        Assert.Equal(wallet.AvailableFunds, depositAmount);
        Assert.Equal(0, wallet.LockedFunds);
        Assert.NotEqual(initialVersion, wallet.Version);
    }

    [Fact]
    public void LockFunds_WhenLockedFundsAreFine_ShouldLockFunds()
    {
        var wallet = new Wallet { UserId = Guid.NewGuid() };
        wallet.AddFunds(100m);
        var versionBeforeLock = wallet.Version;

        wallet.LockFunds(50m);
        
        Assert.Equal(50m, wallet.AvailableFunds);
        Assert.Equal(50m, wallet.LockedFunds);
        Assert.NotEqual(versionBeforeLock, wallet.Version);
    }

    [Fact]
    public void LockFunds_NotEnoughFunds_ShouldThrowException()
    {
        var wallet = new Wallet { UserId = Guid.NewGuid() };
        wallet.AddFunds(10m);
        var versionBeforeAttempt = wallet.Version;

        Assert.Throws<WalletExceptions.InsufficientFundsException>(() => wallet.LockFunds(50m));
        Assert.Equal(10m, wallet.AvailableFunds);
        Assert.Equal(versionBeforeAttempt, wallet.Version);
    }

    [Fact]
    public void UnlockFunds_WhenFundsAreFine_ShouldUnlockFunds()
    {
        var wallet = new Wallet { UserId = Guid.NewGuid() };
        wallet.AddFunds(100m);
        wallet.LockFunds(30m);
        var versionBeforeUnlock = wallet.Version;
        
        wallet.UnlockFunds(30m);
        
        Assert.Equal(100m, wallet.AvailableFunds);
        Assert.Equal(0m, wallet.LockedFunds);
        Assert.NotEqual(versionBeforeUnlock, wallet.Version);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-50)]
    public void AddFunds_WhenAmountIsNotPositive_ShouldThrowException(decimal amount)
    {
        var wallet = new Wallet { UserId = Guid.NewGuid() };
        wallet.AddFunds(100m);
        var versionBeforeAttempt = wallet.Version;

        Assert.Throws<WalletExceptions.InvalidAmountException>(() => wallet.AddFunds(amount));
        Assert.Equal(100m, wallet.AvailableFunds);
        Assert.Equal(versionBeforeAttempt, wallet.Version);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-50)]
    public void LockFunds_WhenAmountIsNotPositive_ShouldThrowException(decimal amount)
    {
        var wallet = new Wallet { UserId = Guid.NewGuid() };
        wallet.AddFunds(100m);
        var versionBeforeAttempt = wallet.Version;

        Assert.Throws<WalletExceptions.InvalidAmountException>(() => wallet.LockFunds(amount));
        Assert.Equal(100m, wallet.AvailableFunds);
        Assert.Equal(0m, wallet.LockedFunds);
        Assert.Equal(versionBeforeAttempt, wallet.Version);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-50)]
    public void UnlockFunds_WhenAmountIsNotPositive_ShouldThrowException(decimal amount)
    {
        var wallet = new Wallet { UserId = Guid.NewGuid() };
        wallet.AddFunds(100m);
        wallet.LockFunds(30m);
        var versionBeforeAttempt = wallet.Version;

        Assert.Throws<WalletExceptions.InvalidAmountException>(() => wallet.UnlockFunds(amount));
        Assert.Equal(70m, wallet.AvailableFunds);
        Assert.Equal(30m, wallet.LockedFunds);
        Assert.Equal(versionBeforeAttempt, wallet.Version);
    }

    [Fact]
    public void UnlockFunds_WhenAmountExceedsLockedFunds_ShouldThrowException()
    {
        var wallet = new Wallet { UserId = Guid.NewGuid() };
        wallet.AddFunds(100m);
        wallet.LockFunds(30m);
        var versionBeforeAttempt = wallet.Version;

        Assert.Throws<WalletExceptions.InsufficientLockedFundsException>(() => wallet.UnlockFunds(50m));
        Assert.Equal(70m, wallet.AvailableFunds);
        Assert.Equal(30m, wallet.LockedFunds);
        Assert.Equal(versionBeforeAttempt, wallet.Version);
    }
}
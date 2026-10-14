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

    [Fact]
    public void Withdraw_WhenFundsAreSufficient_ShouldReduceAvailableFunds()
    {
        var wallet = new Wallet { UserId = Guid.NewGuid() };
        wallet.AddFunds(100m);
        var versionBeforeWithdraw = wallet.Version;

        wallet.Withdraw(60m);

        Assert.Equal(40m, wallet.AvailableFunds);
        Assert.Equal(0m, wallet.LockedFunds);
        Assert.NotEqual(versionBeforeWithdraw, wallet.Version);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-50)]
    public void Withdraw_WhenAmountIsNotPositive_ShouldThrowException(decimal amount)
    {
        var wallet = new Wallet { UserId = Guid.NewGuid() };
        wallet.AddFunds(100m);
        var versionBeforeAttempt = wallet.Version;

        Assert.Throws<WalletExceptions.InvalidAmountException>(() => wallet.Withdraw(amount));
        Assert.Equal(100m, wallet.AvailableFunds);
        Assert.Equal(versionBeforeAttempt, wallet.Version);
    }

    [Fact]
    public void Withdraw_WhenFundsAreInsufficient_ShouldThrowException()
    {
        var wallet = new Wallet { UserId = Guid.NewGuid() };
        wallet.AddFunds(100m);

        Assert.Throws<WalletExceptions.InsufficientFundsException>(() => wallet.Withdraw(150m));
        Assert.Equal(100m, wallet.AvailableFunds);
    }

    [Fact]
    public void Withdraw_WhenFundsAreLocked_ShouldNotSpendLockedFunds()
    {
        var wallet = new Wallet { UserId = Guid.NewGuid() };
        wallet.AddFunds(100m);
        wallet.LockFunds(Guid.NewGuid(), 60m);

        Assert.Throws<WalletExceptions.InsufficientFundsException>(() => wallet.Withdraw(50m));
        Assert.Equal(40m, wallet.AvailableFunds);
        Assert.Equal(60m, wallet.LockedFunds);
    }
}

using AuctionServer.Modules.Wallets.Domain.Entities;
using AuctionServer.Modules.Wallets.Domain.Exceptions;

namespace AuctionServer.Modules.Wallets.Tests.Domain.Entities;

public class WalletCollectUpToTests
{
    private static Wallet CreateWalletWithFunds(decimal funds)
    {
        var wallet = new Wallet { UserId = Guid.NewGuid() };
        if (funds > 0) wallet.AddFunds(funds);
        return wallet;
    }

    [Fact]
    public void CollectUpTo_WhenFundsCoverAmount_ShouldDebitFullAmount()
    {
        var wallet = CreateWalletWithFunds(500m);
        var versionBefore = wallet.Version;

        var collected = wallet.CollectUpTo(220m);

        Assert.Equal(220m, collected);
        Assert.Equal(280m, wallet.AvailableFunds);
        Assert.Equal(500m, wallet.LifetimeTurnover);
        Assert.NotEqual(versionBefore, wallet.Version);
    }

    [Fact]
    public void CollectUpTo_WhenFundsPartiallyCover_ShouldDebitEverything()
    {
        var wallet = CreateWalletWithFunds(100m);

        var collected = wallet.CollectUpTo(220m);

        Assert.Equal(100m, collected);
        Assert.Equal(0m, wallet.AvailableFunds);
    }

    [Fact]
    public void CollectUpTo_WhenNothingAvailable_ShouldReturnZeroWithoutVersionBump()
    {
        var wallet = CreateWalletWithFunds(0m);
        var versionBefore = wallet.Version;

        var collected = wallet.CollectUpTo(220m);

        Assert.Equal(0m, collected);
        Assert.Equal(versionBefore, wallet.Version);
    }

    [Fact]
    public void CollectUpTo_ShouldNeverTouchLockedFunds()
    {
        var wallet = CreateWalletWithFunds(500m);
        wallet.LockFunds(Guid.NewGuid(), 400m);

        var collected = wallet.CollectUpTo(220m);

        Assert.Equal(100m, collected);
        Assert.Equal(0m, wallet.AvailableFunds);
        Assert.Equal(400m, wallet.LockedFunds);
    }

    [Fact]
    public void CollectUpTo_WhenAmountNotPositive_ShouldThrowInvalidAmount()
    {
        var wallet = CreateWalletWithFunds(500m);

        Assert.Throws<WalletExceptions.InvalidAmountException>(() => wallet.CollectUpTo(0m));
    }
}

using AuctionServer.Modules.Wallets.Domain.Entities;
using AuctionServer.Modules.Wallets.Domain.Exceptions;

namespace AuctionServer.Modules.Wallets.Tests.Domain.Entities;

public class WalletPayForPawnshopTests
{
    private static Wallet CreateWalletWithFunds(decimal funds)
    {
        var wallet = new Wallet { UserId = Guid.NewGuid() };
        if (funds > 0) wallet.AddFunds(funds);
        return wallet;
    }

    [Fact]
    public void PayForPawnshop_WhenTurnoverAndFundsSuffice_ShouldDebitAndKeepTurnover()
    {
        var wallet = CreateWalletWithFunds(500m);

        wallet.PayForPawnshop(300m, 400m);

        Assert.Equal(200m, wallet.AvailableFunds);
        Assert.Equal(500m, wallet.LifetimeTurnover);
    }

    [Fact]
    public void PayForPawnshop_WhenTurnoverBelowRequired_ShouldThrowAndKeepFunds()
    {
        var wallet = CreateWalletWithFunds(500m);

        Assert.Throws<WalletExceptions.InsufficientTurnoverException>(() => wallet.PayForPawnshop(300m, 600m));
        Assert.Equal(500m, wallet.AvailableFunds);
    }

    [Fact]
    public void PayForPawnshop_WhenFundsInsufficient_ShouldThrowInsufficientFunds()
    {
        var wallet = CreateWalletWithFunds(100m);

        Assert.Throws<WalletExceptions.InsufficientFundsException>(() => wallet.PayForPawnshop(300m, 100m));
        Assert.Equal(100m, wallet.AvailableFunds);
    }

    [Fact]
    public void PayForPawnshop_WhenRequiredTurnoverIsZero_ShouldSkipGate()
    {
        var wallet = new Wallet { UserId = Guid.NewGuid() };
        wallet.GrantStartingFunds(300m);

        wallet.PayForPawnshop(200m, 0m);

        Assert.Equal(100m, wallet.AvailableFunds);
        Assert.Equal(0m, wallet.LifetimeTurnover);
    }

    [Fact]
    public void PayForPawnshop_WhenAmountNotPositive_ShouldThrowInvalidAmount()
    {
        var wallet = CreateWalletWithFunds(500m);

        Assert.Throws<WalletExceptions.InvalidAmountException>(() => wallet.PayForPawnshop(0m, 0m));
    }

    [Fact]
    public void PayForPawnshop_ShouldRegenerateVersion()
    {
        var wallet = CreateWalletWithFunds(500m);
        var versionBefore = wallet.Version;

        wallet.PayForPawnshop(300m, 400m);

        Assert.NotEqual(versionBefore, wallet.Version);
    }
}

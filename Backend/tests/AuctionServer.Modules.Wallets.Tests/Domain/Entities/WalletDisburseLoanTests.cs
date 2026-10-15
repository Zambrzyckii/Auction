using AuctionServer.Modules.Wallets.Domain.Entities;
using AuctionServer.Modules.Wallets.Domain.Exceptions;

namespace AuctionServer.Modules.Wallets.Tests.Domain.Entities;

public class WalletDisburseLoanTests
{
    private static Wallet CreateWalletWithTurnover(decimal turnover)
    {
        var wallet = new Wallet { UserId = Guid.NewGuid() };
        if (turnover > 0) wallet.AddFunds(turnover);
        return wallet;
    }

    [Fact]
    public void DisburseLoan_WhenTurnoverSufficient_ShouldCreditAndCountTurnover()
    {
        var wallet = CreateWalletWithTurnover(500m);
        var versionBefore = wallet.Version;

        wallet.DisburseLoan(200m, requiredTurnover: 400m);

        Assert.Equal(700m, wallet.AvailableFunds);
        Assert.Equal(700m, wallet.LifetimeTurnover);
        Assert.NotEqual(versionBefore, wallet.Version);
    }

    [Fact]
    public void DisburseLoan_AtExactlyRequiredTurnover_ShouldSucceed()
    {
        var wallet = CreateWalletWithTurnover(400m);

        wallet.DisburseLoan(200m, requiredTurnover: 400m);

        Assert.Equal(600m, wallet.AvailableFunds);
    }

    [Fact]
    public void DisburseLoan_WhenTurnoverBelowRequired_ShouldThrowWithoutChange()
    {
        var wallet = CreateWalletWithTurnover(300m);

        Assert.Throws<WalletExceptions.InsufficientTurnoverException>(() => wallet.DisburseLoan(200m, 400m));
        Assert.Equal(300m, wallet.AvailableFunds);
        Assert.Equal(300m, wallet.LifetimeTurnover);
    }

    [Fact]
    public void DisburseLoan_WithZeroRequiredTurnover_OnFreshWallet_ShouldSucceed()
    {
        var wallet = CreateWalletWithTurnover(0m);

        wallet.DisburseLoan(200m, requiredTurnover: 0m);

        Assert.Equal(200m, wallet.AvailableFunds);
        Assert.Equal(200m, wallet.LifetimeTurnover);
    }

    [Fact]
    public void DisburseLoan_WhenPrincipalNotPositive_ShouldThrowInvalidAmount()
    {
        var wallet = CreateWalletWithTurnover(500m);

        Assert.Throws<WalletExceptions.InvalidAmountException>(() => wallet.DisburseLoan(0m, 400m));
    }
}

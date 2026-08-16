using AuctionServer.Modules.Wallets.Domain.Entities;
using AuctionServer.Modules.Wallets.Domain.Exceptions;

namespace AuctionServer.Modules.Wallets.Tests.Domain.Entities;

public class WalletSpendLockedFundsTests
{
    private static Wallet CreateWalletWithLockedFunds(decimal locked)
    {
        var wallet = new Wallet { UserId = Guid.NewGuid() };
        wallet.AddFunds(locked);
        wallet.LockFunds(locked);
        return wallet;
    }

    [Fact]
    public void SpendLockedFunds_WhenLockedFundsAreSufficient_ShouldReduceOnlyLockedFunds()
    {
        var wallet = CreateWalletWithLockedFunds(100m);
        var versionBefore = wallet.Version;

        wallet.SpendLockedFunds(60m);

        Assert.Equal(40m, wallet.LockedFunds);
        Assert.Equal(0m, wallet.AvailableFunds);
        Assert.NotEqual(versionBefore, wallet.Version);
    }

    [Fact]
    public void SpendLockedFunds_WhenAmountExceedsLockedFunds_ShouldThrow()
    {
        var wallet = CreateWalletWithLockedFunds(50m);

        Assert.Throws<WalletExceptions.InsufficientLockedFundsException>(() => wallet.SpendLockedFunds(51m));
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-10)]
    public void SpendLockedFunds_WhenAmountIsNotPositive_ShouldThrow(decimal amount)
    {
        var wallet = CreateWalletWithLockedFunds(50m);

        Assert.Throws<WalletExceptions.InvalidAmountException>(() => wallet.SpendLockedFunds(amount));
    }
}

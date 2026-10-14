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
}

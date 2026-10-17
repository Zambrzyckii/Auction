using AuctionServer.Modules.Wallets.Domain.Entities;
using AuctionServer.Modules.Wallets.Domain.Exceptions;

namespace AuctionServer.Modules.Wallets.Tests.Domain.Entities;

public class WalletTurnoverTests
{
    private static Wallet CreateWallet() => new() { UserId = Guid.NewGuid() };

    [Fact]
    public void AddFunds_ShouldIncreaseLifetimeTurnover()
    {
        var wallet = CreateWallet();

        wallet.AddFunds(100m);
        wallet.AddFunds(50m);

        Assert.Equal(150m, wallet.AvailableFunds);
        Assert.Equal(150m, wallet.LifetimeTurnover);
    }

    [Fact]
    public void ReceiveTransfer_ShouldIncreaseBalanceButNotTurnover()
    {
        var wallet = CreateWallet();

        wallet.ReceiveTransfer(100m);

        Assert.Equal(100m, wallet.AvailableFunds);
        Assert.Equal(0m, wallet.LifetimeTurnover);
    }

    [Fact]
    public void ReceiveTransfer_WhenAmountIsNotPositive_ShouldThrowInvalidAmountException()
    {
        var wallet = CreateWallet();

        Assert.Throws<WalletExceptions.InvalidAmountException>(() => wallet.ReceiveTransfer(0m));
        Assert.Equal(0m, wallet.AvailableFunds);
    }

    [Fact]
    public void ReceiveTransfer_ShouldRegenerateVersion()
    {
        var wallet = CreateWallet();
        var versionBefore = wallet.Version;

        wallet.ReceiveTransfer(100m);

        Assert.NotEqual(versionBefore, wallet.Version);
    }

    [Fact]
    public void GrantStartingFunds_ShouldIncreaseBalanceButNotTurnover()
    {
        var wallet = CreateWallet();

        wallet.GrantStartingFunds(300m);

        Assert.Equal(300m, wallet.AvailableFunds);
        Assert.Equal(0m, wallet.LifetimeTurnover);
    }

    [Fact]
    public void GrantStartingFunds_WhenAmountIsNotPositive_ShouldThrowInvalidAmountException()
    {
        var wallet = CreateWallet();

        Assert.Throws<WalletExceptions.InvalidAmountException>(() => wallet.GrantStartingFunds(-1m));
    }

    [Fact]
    public void ReceiveCasinoCashOut_ShouldIncreaseBalanceButNotTurnover()
    {
        var wallet = CreateWallet();

        wallet.ReceiveCasinoCashOut(487.5m);

        Assert.Equal(487.5m, wallet.AvailableFunds);
        Assert.Equal(0m, wallet.LifetimeTurnover);
    }

    [Fact]
    public void ReceiveCasinoCashOut_WhenAmountIsNotPositive_ShouldThrowInvalidAmountException()
    {
        var wallet = CreateWallet();

        Assert.Throws<WalletExceptions.InvalidAmountException>(() => wallet.ReceiveCasinoCashOut(0m));
        Assert.Equal(0m, wallet.AvailableFunds);
    }

    [Fact]
    public void ReceiveCasinoCashOut_ShouldRegenerateVersion()
    {
        var wallet = CreateWallet();
        var versionBefore = wallet.Version;

        wallet.ReceiveCasinoCashOut(100m);

        Assert.NotEqual(versionBefore, wallet.Version);
    }

    [Fact]
    public void Withdraw_ShouldNotChangeTurnover()
    {
        var wallet = CreateWallet();
        wallet.AddFunds(100m);

        wallet.Withdraw(60m);

        Assert.Equal(100m, wallet.LifetimeTurnover);
    }

    [Fact]
    public void ReleaseLock_ShouldNotChangeTurnover()
    {
        var wallet = CreateWallet();
        wallet.AddFunds(100m);
        var auctionId = Guid.NewGuid();
        wallet.LockFunds(auctionId, 60m);

        wallet.ReleaseLock(auctionId);

        Assert.Equal(100m, wallet.AvailableFunds);
        Assert.Equal(100m, wallet.LifetimeTurnover);
    }

    [Fact]
    public void SpendLock_LeftoverRefund_ShouldNotChangeTurnover()
    {
        var wallet = CreateWallet();
        wallet.AddFunds(100m);
        var warehouseId = Guid.NewGuid();
        wallet.LockFunds(warehouseId, 60m);

        wallet.SpendLock(warehouseId, 40m);

        Assert.Equal(60m, wallet.AvailableFunds);
        Assert.Equal(100m, wallet.LifetimeTurnover);
    }

    [Fact]
    public void ConsumeLock_ShouldNotChangeTurnover()
    {
        var wallet = CreateWallet();
        wallet.AddFunds(100m);
        var auctionId = Guid.NewGuid();
        wallet.LockFunds(auctionId, 60m);

        wallet.ConsumeLock(auctionId);

        Assert.Equal(100m, wallet.LifetimeTurnover);
    }
}

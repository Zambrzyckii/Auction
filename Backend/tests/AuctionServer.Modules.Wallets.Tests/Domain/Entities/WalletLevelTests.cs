using AuctionServer.Modules.Wallets.Domain;
using AuctionServer.Modules.Wallets.Domain.Entities;

namespace AuctionServer.Modules.Wallets.Tests.Domain.Entities;

public class WalletLevelTests
{
    private static Wallet CreateWallet() => new() { UserId = Guid.NewGuid() };

    [Fact]
    public void AddFunds_WhenTurnoverIsBelowFirstThreshold_ShouldNotLevel()
    {
        var wallet = CreateWallet();

        wallet.AddFunds(999.99m);

        Assert.Equal(0, wallet.RewardedLevel);
        Assert.Equal(999.99m, wallet.AvailableFunds);
    }

    [Fact]
    public void AddFunds_WhenTurnoverReachesFirstThreshold_ShouldAwardLevelOne()
    {
        var wallet = CreateWallet();

        wallet.AddFunds(1000m);

        Assert.Equal(1, wallet.RewardedLevel);
        Assert.Equal(1010m, wallet.AvailableFunds);
        Assert.Equal(1000m, wallet.LifetimeTurnover);
    }

    [Fact]
    public void AddFunds_WhenOneCreditCrossesThreeLevels_ShouldAwardAllRewards()
    {
        var wallet = CreateWallet();

        wallet.AddFunds(9000m);

        Assert.Equal(3, wallet.RewardedLevel);
        Assert.Equal(9140m, wallet.AvailableFunds);
        Assert.Equal(9000m, wallet.LifetimeTurnover);
    }

    [Fact]
    public void AddFunds_WhenCalledRepeatedly_ShouldAwardEachLevelOnce()
    {
        var wallet = CreateWallet();

        wallet.AddFunds(1000m);
        wallet.AddFunds(3000m);
        wallet.AddFunds(1m);

        Assert.Equal(2, wallet.RewardedLevel);
        Assert.Equal(1000m + 10m + 3000m + 40m + 1m, wallet.AvailableFunds);
    }

    [Fact]
    public void AddFunds_WhenTurnoverReachesTheCap_ShouldStopAtLevelHundred()
    {
        var wallet = CreateWallet();

        wallet.AddFunds(10_000_000m);

        Assert.Equal(PlayerLevels.MaxRewardedLevel, wallet.RewardedLevel);
        Assert.Equal(10_000_000m + 3_383_500m, wallet.AvailableFunds);

        wallet.AddFunds(1_000_000m);

        Assert.Equal(PlayerLevels.MaxRewardedLevel, wallet.RewardedLevel);
        Assert.Equal(11_000_000m + 3_383_500m, wallet.AvailableFunds);
    }

    [Fact]
    public void Credit_WhenItDoesNotCountTowardTurnover_ShouldNeverLevel()
    {
        var wallet = CreateWallet();

        wallet.ReceiveTransfer(5000m);
        wallet.GrantStartingFunds(5000m);
        wallet.ReceiveCasinoCashOut(5000m);

        Assert.Equal(0, wallet.RewardedLevel);
        Assert.Equal(15_000m, wallet.AvailableFunds);
    }

    [Fact]
    public void DisburseLoan_ShouldCountTowardLevels()
    {
        var wallet = CreateWallet();

        wallet.DisburseLoan(5000m, requiredTurnover: 0m);

        Assert.Equal(2, wallet.RewardedLevel);
        Assert.Equal(5050m, wallet.AvailableFunds);
    }

    [Fact]
    public void AddFunds_RewardShouldNotFeedTurnover()
    {
        var wallet = CreateWallet();

        wallet.AddFunds(1000m);

        Assert.Equal(1000m, wallet.LifetimeTurnover);
    }
}

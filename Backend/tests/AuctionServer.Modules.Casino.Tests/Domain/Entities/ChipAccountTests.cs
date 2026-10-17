using AuctionServer.Modules.Casino.Domain.Entities;
using AuctionServer.Modules.Casino.Domain.Exceptions;

namespace AuctionServer.Modules.Casino.Tests.Domain.Entities;

public class ChipAccountTests
{
    private static readonly DateTime Now = new(2026, 10, 16, 12, 0, 0, DateTimeKind.Utc);

    private static ChipAccount AccountWith(decimal balance)
    {
        var account = ChipAccount.Open(Guid.NewGuid(), Now);
        account.ReceivePurchase(balance);
        return account;
    }

    [Fact]
    public void Open_ShouldStartEmpty()
    {
        var userId = Guid.NewGuid();

        var account = ChipAccount.Open(userId, Now);

        Assert.Equal(userId, account.UserId);
        Assert.Equal(0m, account.Balance);
        Assert.Equal(0m, account.LifetimeBought);
        Assert.Equal(0m, account.LifetimeCashedOut);
        Assert.Equal(Now, account.CreatedOn);
    }

    [Fact]
    public void ReceivePurchase_ShouldGrowBalanceAndLifetimeBought()
    {
        var account = ChipAccount.Open(Guid.NewGuid(), Now);
        var versionBefore = account.Version;

        account.ReceivePurchase(500m);

        Assert.Equal(500m, account.Balance);
        Assert.Equal(500m, account.LifetimeBought);
        Assert.NotEqual(versionBefore, account.Version);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    public void ReceivePurchase_WhenNotPositive_ShouldThrow(decimal amount) =>
        Assert.Throws<CasinoExceptions.InvalidChipAmountException>(
            () => ChipAccount.Open(Guid.NewGuid(), Now).ReceivePurchase(amount));

    [Fact]
    public void PlaceStake_ShouldReduceBalanceOnly()
    {
        var account = AccountWith(500m);
        var versionBefore = account.Version;

        account.PlaceStake(100m);

        Assert.Equal(400m, account.Balance);
        Assert.Equal(500m, account.LifetimeBought);
        Assert.NotEqual(versionBefore, account.Version);
    }

    [Fact]
    public void PlaceStake_WhenMoreThanBalance_ShouldThrow() =>
        Assert.Throws<CasinoExceptions.InsufficientChipsException>(() => AccountWith(500m).PlaceStake(501m));

    [Theory]
    [InlineData(0)]
    [InlineData(-5)]
    public void PlaceStake_WhenNotPositive_ShouldThrow(decimal amount) =>
        Assert.Throws<CasinoExceptions.InvalidChipAmountException>(() => AccountWith(500m).PlaceStake(amount));

    [Fact]
    public void Credit_ShouldGrowBalanceWithoutLifetimeBought()
    {
        var account = AccountWith(500m);

        account.Credit(200m);

        Assert.Equal(700m, account.Balance);
        Assert.Equal(500m, account.LifetimeBought);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-5)]
    public void Credit_WhenNotPositive_ShouldThrow(decimal amount) =>
        Assert.Throws<CasinoExceptions.InvalidChipAmountException>(() => AccountWith(500m).Credit(amount));

    [Fact]
    public void CashOut_WithHalfChip_ShouldMoveItToLifetimeCashedOut()
    {
        var account = AccountWith(500m);
        var versionBefore = account.Version;

        account.CashOut(12.5m);

        Assert.Equal(487.5m, account.Balance);
        Assert.Equal(12.5m, account.LifetimeCashedOut);
        Assert.NotEqual(versionBefore, account.Version);
    }

    [Fact]
    public void CashOut_WhenMoreThanBalance_ShouldThrow() =>
        Assert.Throws<CasinoExceptions.InsufficientChipsException>(() => AccountWith(500m).CashOut(500.01m));

    [Theory]
    [InlineData(0)]
    [InlineData(-5)]
    [InlineData(0.005)]
    public void CashOut_WhenNotPositiveOrBeyondCents_ShouldThrow(decimal amount) =>
        Assert.Throws<CasinoExceptions.InvalidChipAmountException>(() => AccountWith(500m).CashOut(amount));
}

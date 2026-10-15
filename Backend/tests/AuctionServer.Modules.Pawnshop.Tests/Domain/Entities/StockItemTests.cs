using AuctionServer.Modules.Pawnshop.Domain.Entities;
using AuctionServer.Modules.Pawnshop.Domain.Enums;
using AuctionServer.Modules.Pawnshop.Domain.Exceptions;

namespace AuctionServer.Modules.Pawnshop.Tests.Domain.Entities;

public class StockItemTests
{
    private static readonly DateTime Now = new(2026, 10, 15, 12, 0, 0, DateTimeKind.Utc);
    private static readonly DateTime DueOn = Now.AddMinutes(5);

    private static StockItem Create(decimal price = 55m, decimal payoutRate = 0.5m,
        Guid? pawnshopId = null, Guid? userId = null) =>
        new()
        {
            PublicPawnshopId = pawnshopId ?? Guid.NewGuid(),
            UserId = userId ?? Guid.NewGuid(),
            Name = "Pawned Common Good",
            Rarity = PawnshopRarity.Common,
            Price = price,
            PayoutRate = payoutRate,
            SpawnedOn = Now,
            SellAfter = DueOn
        };

    [Fact]
    public void Withdraw_WhenInStockBeforeSellAfter_ShouldWithdraw()
    {
        var item = Create();
        var versionBefore = item.Version;

        item.Withdraw(Now.AddMinutes(2));

        Assert.Equal(StockItemStatus.Withdrawn, item.Status);
        Assert.Equal(Now.AddMinutes(2), item.ResolvedOn);
        Assert.Null(item.PayoutAmount);
        Assert.NotEqual(versionBefore, item.Version);
    }

    [Fact]
    public void Withdraw_WhenAtSellAfter_ShouldThrowWindowClosed()
    {
        var item = Create();

        Assert.Throws<PawnshopExceptions.StockWindowClosedException>(() => item.Withdraw(DueOn));
        Assert.Equal(StockItemStatus.InStock, item.Status);
    }

    [Fact]
    public void Withdraw_WhenAlreadyWithdrawn_ShouldThrowNotInStock()
    {
        var item = Create();
        item.Withdraw(Now.AddMinutes(2));

        Assert.Throws<PawnshopExceptions.StockItemNotInStockException>(() => item.Withdraw(Now.AddMinutes(3)));
    }

    [Fact]
    public void Withdraw_WhenSold_ShouldThrowNotInStock()
    {
        var item = Create();
        item.Sell(DueOn);

        Assert.Throws<PawnshopExceptions.StockItemNotInStockException>(() => item.Withdraw(Now.AddMinutes(2)));
    }

    [Fact]
    public void Sell_WhenBeforeSellAfter_ShouldThrowNotDue()
    {
        var item = Create();

        Assert.Throws<PawnshopExceptions.StockItemNotDueException>(() => item.Sell(Now.AddMinutes(4)));
        Assert.Equal(StockItemStatus.InStock, item.Status);
    }

    [Fact]
    public void Sell_WhenDue_ShouldSetPayoutRoundedAwayFromZero()
    {
        var item = Create(price: 15m, payoutRate: 0.015m);

        var payout = item.Sell(DueOn);

        Assert.Equal(0.23m, payout);
        Assert.Equal(0.23m, item.PayoutAmount);
        Assert.Equal(StockItemStatus.Sold, item.Status);
        Assert.Equal(DueOn, item.ResolvedOn);
    }

    [Fact]
    public void Sell_WhenAlreadyResolved_ShouldThrowNotInStock()
    {
        var item = Create();
        item.Withdraw(Now.AddMinutes(2));

        Assert.Throws<PawnshopExceptions.StockItemNotInStockException>(() => item.Sell(DueOn));
    }

    [Fact]
    public void SellDue_ShouldGroupByShopAndSumPerItemRoundedPayouts()
    {
        var pawnshopId = Guid.NewGuid();
        var userId = Guid.NewGuid();
        var items = new[]
        {
            Create(price: 15m, payoutRate: 0.015m, pawnshopId: pawnshopId, userId: userId),
            Create(price: 15m, payoutRate: 0.015m, pawnshopId: pawnshopId, userId: userId),
            Create(price: 100m, payoutRate: 0.5m)
        };

        var batches = StockItem.SellDue(items, DueOn);

        Assert.Equal(2, batches.Count);
        var grouped = Assert.Single(batches, b => b.PublicPawnshopId == pawnshopId);
        Assert.Equal(userId, grouped.UserId);
        Assert.Equal(0.46m, grouped.Amount);
        Assert.All(items, i => Assert.Equal(StockItemStatus.Sold, i.Status));
    }

    [Fact]
    public void SellDue_WhenAnItemIsNotDue_ShouldThrow()
    {
        var items = new[] { Create(), Create() };

        Assert.Throws<PawnshopExceptions.StockItemNotDueException>(
            () => StockItem.SellDue(items, Now.AddMinutes(4)));
    }
}

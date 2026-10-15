using AuctionServer.Modules.Pawnshop.Domain.Entities;
using AuctionServer.Modules.Pawnshop.Domain.Enums;
using AuctionServer.Modules.Pawnshop.Domain.Exceptions;
using AuctionServer.Shared.Integration.Events.Pawnshop;

namespace AuctionServer.Modules.Pawnshop.Tests.Domain.Entities;

public class ShopStockTests
{
    private static readonly DateTime Now = new(2026, 10, 15, 12, 0, 0, DateTimeKind.Utc);
    private static readonly TimeSpan Interval = TimeSpan.FromSeconds(30);
    private static readonly TimeSpan SellDelay = TimeSpan.FromMinutes(5);

    private static Shop ActiveShop()
    {
        var shop = Shop.Open(Guid.NewGuid(), Now);
        shop.CompletePayment(shop.PendingPaymentId!.Value, Now);
        return shop;
    }

    private static Shop ShopWithBot(decimal payoutRate = 0.5m)
    {
        var shop = ActiveShop();
        var paymentId = shop.BeginBotPurchase("Seed Bot", PawnshopRarity.Common, Interval, payoutRate, Now);
        shop.CompletePayment(paymentId, Now);
        return shop;
    }

    private static PawnshopStockItem CommonGood(decimal price = 55m) => new("Pawned Common Good", "Common", price);

    [Fact]
    public void RequestSpawn_WhenDue_ShouldFreezeRateAndAnchorSchedule()
    {
        var shop = ShopWithBot(payoutRate: 0.5m);
        var callTime = Now.AddSeconds(35);

        var (requestId, rarity) = shop.RequestSpawn(callTime);

        Assert.Equal(requestId, shop.PendingStockRequestId);
        Assert.Equal(callTime, shop.PendingStockRequestedOn);
        Assert.Equal(0.5m, shop.PendingStockPayoutRate);
        Assert.Equal(PawnshopRarity.Common, rarity);
        Assert.Equal(callTime + Interval, shop.NextSpawnOn);
    }

    [Fact]
    public void RequestSpawn_WhenNoBot_ShouldThrow()
    {
        var shop = ActiveShop();

        Assert.Throws<PawnshopExceptions.InvalidShopStateTransitionException>(
            () => shop.RequestSpawn(Now.AddSeconds(35)));
    }

    [Fact]
    public void RequestSpawn_WhenNotActive_ShouldThrow()
    {
        var shop = Shop.Open(Guid.NewGuid(), Now);

        Assert.Throws<PawnshopExceptions.InvalidShopStateTransitionException>(
            () => shop.RequestSpawn(Now.AddSeconds(35)));
    }

    [Fact]
    public void RequestSpawn_WhenRequestPending_ShouldThrow()
    {
        var shop = ShopWithBot();
        shop.RequestSpawn(Now.AddSeconds(35));

        Assert.Throws<PawnshopExceptions.InvalidShopStateTransitionException>(
            () => shop.RequestSpawn(Now.AddSeconds(70)));
    }

    [Fact]
    public void RequestSpawn_WhenNotYetDue_ShouldThrow()
    {
        var shop = ShopWithBot();

        Assert.Throws<PawnshopExceptions.InvalidShopStateTransitionException>(
            () => shop.RequestSpawn(Now.AddSeconds(10)));
    }

    [Fact]
    public void ReceiveStock_WhenRequestIdMatches_ShouldCreateItemsWithWindowAndFrozenRate()
    {
        var shop = ShopWithBot(payoutRate: 0.5m);
        var (requestId, _) = shop.RequestSpawn(Now.AddSeconds(35));
        var receiveTime = Now.AddSeconds(42);

        var items = shop.ReceiveStock(requestId, [CommonGood()], SellDelay, receiveTime);

        var item = Assert.Single(items);
        Assert.Equal(shop.PublicPawnshopId, item.PublicPawnshopId);
        Assert.Equal(shop.UserId, item.UserId);
        Assert.Equal("Pawned Common Good", item.Name);
        Assert.Equal(PawnshopRarity.Common, item.Rarity);
        Assert.Equal(55m, item.Price);
        Assert.Equal(0.5m, item.PayoutRate);
        Assert.Equal(StockItemStatus.InStock, item.Status);
        Assert.Equal(receiveTime, item.SpawnedOn);
        Assert.Equal(receiveTime + SellDelay, item.SellAfter);
        Assert.Null(shop.PendingStockRequestId);
        Assert.Null(shop.PendingStockPayoutRate);
    }

    [Fact]
    public void ReceiveStock_WhenRequestIdDiffers_ShouldThrow()
    {
        var shop = ShopWithBot();
        shop.RequestSpawn(Now.AddSeconds(35));

        Assert.Throws<PawnshopExceptions.InvalidShopStateTransitionException>(
            () => shop.ReceiveStock(Guid.NewGuid(), [CommonGood()], SellDelay, Now.AddSeconds(42)));
        Assert.NotNull(shop.PendingStockRequestId);
    }

    [Fact]
    public void ReceiveStock_WhenNothingPending_ShouldThrow()
    {
        var shop = ShopWithBot();

        Assert.Throws<PawnshopExceptions.InvalidShopStateTransitionException>(
            () => shop.ReceiveStock(Guid.NewGuid(), [CommonGood()], SellDelay, Now.AddSeconds(42)));
    }

    [Fact]
    public void ReceiveStock_WhenStockEmpty_ShouldThrow()
    {
        var shop = ShopWithBot();
        var (requestId, _) = shop.RequestSpawn(Now.AddSeconds(35));

        Assert.Throws<PawnshopExceptions.InvalidStockException>(
            () => shop.ReceiveStock(requestId, [], SellDelay, Now.AddSeconds(42)));
    }

    [Fact]
    public void ReceiveStock_WhenBotReplacedMidFlight_ShouldUseSnapshotRate()
    {
        var shop = ShopWithBot(payoutRate: 0.5m);
        var (requestId, _) = shop.RequestSpawn(Now.AddSeconds(35));
        var upgradeId = shop.BeginBotPurchase("Appraiser", PawnshopRarity.Rare, Interval, 0.75m, Now.AddSeconds(36));
        shop.CompletePayment(upgradeId, Now.AddSeconds(40));

        var items = shop.ReceiveStock(requestId, [CommonGood()], SellDelay, Now.AddSeconds(42));

        Assert.Equal(0.5m, Assert.Single(items).PayoutRate);
        Assert.Equal(0.75m, shop.BotPayoutRate);
    }

    [Fact]
    public void ExpireStockRequest_ShouldClearPendingAndKeepSchedule()
    {
        var shop = ShopWithBot();
        shop.RequestSpawn(Now.AddSeconds(35));
        var scheduled = shop.NextSpawnOn;

        shop.ExpireStockRequest();

        Assert.Null(shop.PendingStockRequestId);
        Assert.Null(shop.PendingStockRequestedOn);
        Assert.Null(shop.PendingStockPayoutRate);
        Assert.Equal(scheduled, shop.NextSpawnOn);
    }
}

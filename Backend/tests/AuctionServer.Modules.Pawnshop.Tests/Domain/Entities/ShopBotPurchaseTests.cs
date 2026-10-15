using AuctionServer.Modules.Pawnshop.Domain.Entities;
using AuctionServer.Modules.Pawnshop.Domain.Enums;
using AuctionServer.Modules.Pawnshop.Domain.Exceptions;

namespace AuctionServer.Modules.Pawnshop.Tests.Domain.Entities;

public class ShopBotPurchaseTests
{
    private static readonly DateTime Now = new(2026, 10, 15, 12, 0, 0, DateTimeKind.Utc);
    private static readonly TimeSpan Interval = TimeSpan.FromSeconds(30);

    private static Shop ActiveShop()
    {
        var shop = Shop.Open(Guid.NewGuid(), Now);
        shop.CompletePayment(shop.PendingPaymentId!.Value, Now);
        return shop;
    }

    private static Shop ShopWithBot(PawnshopRarity rarity)
    {
        var shop = ActiveShop();
        var paymentId = shop.BeginBotPurchase("Seed Bot", rarity, Interval, 0.5m, Now);
        shop.CompletePayment(paymentId, Now.AddSeconds(7));
        return shop;
    }

    [Fact]
    public void BeginBotPurchase_WhenActiveWithoutBot_ShouldRecordPendingBotAndPaymentId()
    {
        var shop = ActiveShop();

        var paymentId = shop.BeginBotPurchase("Pawn Clerk", PawnshopRarity.Common, Interval, 0.5m, Now.AddMinutes(1));

        Assert.Equal(paymentId, shop.PendingPaymentId);
        Assert.Equal(Now.AddMinutes(1), shop.PendingPaymentRequestedOn);
        Assert.Equal("Pawn Clerk", shop.PendingBotTierName);
        Assert.Equal(PawnshopRarity.Common, shop.PendingBotRarity);
        Assert.Equal(Interval, shop.PendingBotSpawnInterval);
        Assert.Equal(0.5m, shop.PendingBotPayoutRate);
        Assert.Null(shop.BotTierName);
    }

    [Fact]
    public void BeginBotPurchase_WhenPremisesPending_ShouldThrowNotActive()
    {
        var shop = Shop.Open(Guid.NewGuid(), Now);

        Assert.Throws<PawnshopExceptions.PawnshopNotActiveException>(
            () => shop.BeginBotPurchase("Pawn Clerk", PawnshopRarity.Common, Interval, 0.5m, Now));
    }

    [Fact]
    public void BeginBotPurchase_WhenRejected_ShouldThrowNotActive()
    {
        var shop = Shop.Open(Guid.NewGuid(), Now);
        shop.ExpirePayment();

        Assert.Throws<PawnshopExceptions.PawnshopNotActiveException>(
            () => shop.BeginBotPurchase("Pawn Clerk", PawnshopRarity.Common, Interval, 0.5m, Now));
    }

    [Fact]
    public void BeginBotPurchase_WhenPaymentInFlight_ShouldThrowPaymentInProgress()
    {
        var shop = ActiveShop();
        shop.BeginBotPurchase("Pawn Clerk", PawnshopRarity.Common, Interval, 0.5m, Now);

        Assert.Throws<PawnshopExceptions.PaymentInProgressException>(
            () => shop.BeginBotPurchase("Appraiser", PawnshopRarity.Rare, Interval, 0.5m, Now.AddSeconds(2)));
    }

    [Fact]
    public void BeginBotPurchase_WhenSameRarity_ShouldThrowNotAnUpgrade()
    {
        var shop = ShopWithBot(PawnshopRarity.Rare);

        Assert.Throws<PawnshopExceptions.BotNotAnUpgradeException>(
            () => shop.BeginBotPurchase("Another Rare", PawnshopRarity.Rare, Interval, 0.5m, Now));
    }

    [Fact]
    public void BeginBotPurchase_WhenLowerRarity_ShouldThrowNotAnUpgrade()
    {
        var shop = ShopWithBot(PawnshopRarity.Epic);

        Assert.Throws<PawnshopExceptions.BotNotAnUpgradeException>(
            () => shop.BeginBotPurchase("Pawn Clerk", PawnshopRarity.Common, Interval, 0.5m, Now));
    }

    [Fact]
    public void BeginBotPurchase_WhenHigherRarity_ShouldAllow()
    {
        var shop = ShopWithBot(PawnshopRarity.Common);

        var paymentId = shop.BeginBotPurchase("Appraiser", PawnshopRarity.Rare, Interval, 0.5m, Now);

        Assert.Equal(paymentId, shop.PendingPaymentId);
        Assert.Equal("Appraiser", shop.PendingBotTierName);
        Assert.Equal("Seed Bot", shop.BotTierName);
    }

    [Fact]
    public void BeginBotPurchase_ShouldClearPreviousRejectionReason()
    {
        var shop = ActiveShop();
        var rejectedPaymentId = shop.BeginBotPurchase("Pawn Clerk", PawnshopRarity.Common, Interval, 0.5m, Now);
        shop.RejectPayment(rejectedPaymentId, "Insufficient funds");

        shop.BeginBotPurchase("Pawn Clerk", PawnshopRarity.Common, Interval, 0.5m, Now);

        Assert.Null(shop.RejectionReason);
    }

    [Fact]
    public void CompletePayment_WhenBotPending_ShouldInstallBotAndScheduleFirstSpawn()
    {
        var shop = ActiveShop();
        var activatedOn = shop.ActivatedOn;
        var paymentId = shop.BeginBotPurchase("Pawn Clerk", PawnshopRarity.Common, Interval, 0.5m, Now);

        shop.CompletePayment(paymentId, Now.AddSeconds(7));

        Assert.Equal(ShopStatus.Active, shop.Status);
        Assert.Equal(activatedOn, shop.ActivatedOn);
        Assert.Equal("Pawn Clerk", shop.BotTierName);
        Assert.Equal(PawnshopRarity.Common, shop.BotRarity);
        Assert.Equal(Interval, shop.BotSpawnInterval);
        Assert.Equal(0.5m, shop.BotPayoutRate);
        Assert.Equal(Now.AddSeconds(7), shop.BotPurchasedOn);
        Assert.Equal(Now.AddSeconds(7) + Interval, shop.NextSpawnOn);
        Assert.Null(shop.PendingBotTierName);
        Assert.Null(shop.PendingPaymentId);
    }

    [Fact]
    public void RejectPayment_WhenBotPending_ShouldKeepShopActiveAndStoreReason()
    {
        var shop = ShopWithBot(PawnshopRarity.Common);
        var paymentId = shop.BeginBotPurchase("Appraiser", PawnshopRarity.Rare, Interval, 0.5m, Now);

        shop.RejectPayment(paymentId, "Insufficient funds");

        Assert.Equal(ShopStatus.Active, shop.Status);
        Assert.Equal("Insufficient funds", shop.RejectionReason);
        Assert.Equal("Seed Bot", shop.BotTierName);
        Assert.Null(shop.PendingBotTierName);
        Assert.Null(shop.PendingPaymentId);
    }

    [Fact]
    public void ExpirePayment_WhenBotPending_ShouldKeepShopActive()
    {
        var shop = ActiveShop();
        shop.BeginBotPurchase("Pawn Clerk", PawnshopRarity.Common, Interval, 0.5m, Now);

        shop.ExpirePayment();

        Assert.Equal(ShopStatus.Active, shop.Status);
        Assert.Equal("Payment timed out", shop.RejectionReason);
        Assert.Null(shop.PendingBotTierName);
    }
}

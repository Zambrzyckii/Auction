using AuctionServer.Modules.Pawnshop.Domain.Entities;
using AuctionServer.Modules.Pawnshop.Domain.Enums;
using AuctionServer.Modules.Pawnshop.Domain.Exceptions;

namespace AuctionServer.Modules.Pawnshop.Tests.Domain.Entities;

public class ShopPremisesTests
{
    private static readonly DateTime Now = new(2026, 10, 15, 12, 0, 0, DateTimeKind.Utc);

    [Fact]
    public void Open_ShouldStartPendingPaymentWithPaymentId()
    {
        var userId = Guid.NewGuid();

        var shop = Shop.Open(userId, Now);

        Assert.Equal(ShopStatus.PendingPayment, shop.Status);
        Assert.Equal(userId, shop.UserId);
        Assert.Equal(Now, shop.RequestedOn);
        Assert.NotNull(shop.PendingPaymentId);
        Assert.Equal(Now, shop.PendingPaymentRequestedOn);
    }

    [Fact]
    public void CompletePayment_WhenPremisesPending_ShouldActivate()
    {
        var shop = Shop.Open(Guid.NewGuid(), Now);
        var versionBefore = shop.Version;

        shop.CompletePayment(shop.PendingPaymentId!.Value, Now.AddSeconds(7));

        Assert.Equal(ShopStatus.Active, shop.Status);
        Assert.Equal(Now.AddSeconds(7), shop.ActivatedOn);
        Assert.Null(shop.PendingPaymentId);
        Assert.Null(shop.PendingPaymentRequestedOn);
        Assert.NotEqual(versionBefore, shop.Version);
    }

    [Fact]
    public void CompletePayment_WhenPaymentIdDiffers_ShouldThrow()
    {
        var shop = Shop.Open(Guid.NewGuid(), Now);

        Assert.Throws<PawnshopExceptions.InvalidShopStateTransitionException>(
            () => shop.CompletePayment(Guid.NewGuid(), Now));
        Assert.Equal(ShopStatus.PendingPayment, shop.Status);
    }

    [Fact]
    public void CompletePayment_WhenPaymentExpired_ShouldThrow()
    {
        var shop = Shop.Open(Guid.NewGuid(), Now);
        var stalePaymentId = shop.PendingPaymentId!.Value;
        shop.ExpirePayment();

        Assert.Throws<PawnshopExceptions.InvalidShopStateTransitionException>(
            () => shop.CompletePayment(stalePaymentId, Now));
        Assert.Equal(ShopStatus.Rejected, shop.Status);
    }

    [Fact]
    public void RejectPayment_WhenPremisesPending_ShouldRejectWithReason()
    {
        var shop = Shop.Open(Guid.NewGuid(), Now);

        shop.RejectPayment(shop.PendingPaymentId!.Value, "Insufficient turnover");

        Assert.Equal(ShopStatus.Rejected, shop.Status);
        Assert.Equal("Insufficient turnover", shop.RejectionReason);
        Assert.Null(shop.PendingPaymentId);
        Assert.Null(shop.ActivatedOn);
    }

    [Fact]
    public void ExpirePayment_WhenPremisesPending_ShouldRejectWithTimeoutReason()
    {
        var shop = Shop.Open(Guid.NewGuid(), Now);

        shop.ExpirePayment();

        Assert.Equal(ShopStatus.Rejected, shop.Status);
        Assert.Equal("Payment timed out", shop.RejectionReason);
        Assert.Null(shop.PendingPaymentId);
    }
}

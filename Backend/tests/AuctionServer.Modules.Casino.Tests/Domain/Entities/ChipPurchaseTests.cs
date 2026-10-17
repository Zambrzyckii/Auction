using AuctionServer.Modules.Casino.Domain.Entities;
using AuctionServer.Modules.Casino.Domain.Enums;
using AuctionServer.Modules.Casino.Domain.Exceptions;

namespace AuctionServer.Modules.Casino.Tests.Domain.Entities;

public class ChipPurchaseTests
{
    private static readonly DateTime Now = new(2026, 10, 16, 12, 0, 0, DateTimeKind.Utc);

    [Fact]
    public void Request_WhenAmountIsWhole_ShouldStartPending()
    {
        var userId = Guid.NewGuid();

        var purchase = ChipPurchase.Request(userId, 500m, Now);

        Assert.Equal(ChipPurchaseStatus.Pending, purchase.Status);
        Assert.Equal(userId, purchase.UserId);
        Assert.Equal(500m, purchase.Amount);
        Assert.Equal(Now, purchase.RequestedOn);
        Assert.Null(purchase.ResolvedOn);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-10)]
    [InlineData(10.5)]
    public void Request_WhenAmountIsNotPositiveWhole_ShouldThrow(decimal amount) =>
        Assert.Throws<CasinoExceptions.InvalidChipAmountException>(() => ChipPurchase.Request(Guid.NewGuid(), amount, Now));

    [Fact]
    public void Complete_WhenPending_ShouldMarkCompleted()
    {
        var purchase = ChipPurchase.Request(Guid.NewGuid(), 500m, Now);
        var versionBefore = purchase.Version;

        purchase.Complete(Now.AddSeconds(7));

        Assert.Equal(ChipPurchaseStatus.Completed, purchase.Status);
        Assert.Equal(Now.AddSeconds(7), purchase.ResolvedOn);
        Assert.NotEqual(versionBefore, purchase.Version);
    }

    [Fact]
    public void Complete_WhenExpired_ShouldStillCompleteAndClearReason()
    {
        var purchase = ChipPurchase.Request(Guid.NewGuid(), 500m, Now);
        purchase.Expire(Now.AddMinutes(15));

        purchase.Complete(Now.AddMinutes(20));

        Assert.Equal(ChipPurchaseStatus.Completed, purchase.Status);
        Assert.Null(purchase.RejectionReason);
        Assert.Equal(Now.AddMinutes(20), purchase.ResolvedOn);
    }

    [Fact]
    public void Complete_WhenRejected_ShouldThrow()
    {
        var purchase = ChipPurchase.Request(Guid.NewGuid(), 500m, Now);
        purchase.Reject("Not enough funds on account", Now);

        Assert.Throws<CasinoExceptions.InvalidPurchaseStateTransitionException>(() => purchase.Complete(Now));
    }

    [Fact]
    public void Complete_WhenAlreadyCompleted_ShouldThrow()
    {
        var purchase = ChipPurchase.Request(Guid.NewGuid(), 500m, Now);
        purchase.Complete(Now);

        Assert.Throws<CasinoExceptions.InvalidPurchaseStateTransitionException>(() => purchase.Complete(Now));
    }

    [Fact]
    public void Reject_WhenPending_ShouldStoreReason()
    {
        var purchase = ChipPurchase.Request(Guid.NewGuid(), 500m, Now);

        purchase.Reject("Not enough funds on account", Now.AddSeconds(7));

        Assert.Equal(ChipPurchaseStatus.Rejected, purchase.Status);
        Assert.Equal("Not enough funds on account", purchase.RejectionReason);
        Assert.Equal(Now.AddSeconds(7), purchase.ResolvedOn);
    }

    [Fact]
    public void Reject_WhenExpired_ShouldChangeNothing()
    {
        var purchase = ChipPurchase.Request(Guid.NewGuid(), 500m, Now);
        purchase.Expire(Now.AddMinutes(15));
        var versionBefore = purchase.Version;

        purchase.Reject("Not enough funds on account", Now.AddMinutes(20));

        Assert.Equal(ChipPurchaseStatus.Expired, purchase.Status);
        Assert.Equal("Purchase timed out", purchase.RejectionReason);
        Assert.Equal(versionBefore, purchase.Version);
    }

    [Fact]
    public void Reject_WhenCompleted_ShouldThrow()
    {
        var purchase = ChipPurchase.Request(Guid.NewGuid(), 500m, Now);
        purchase.Complete(Now);

        Assert.Throws<CasinoExceptions.InvalidPurchaseStateTransitionException>(
            () => purchase.Reject("Not enough funds on account", Now));
    }

    [Fact]
    public void Expire_WhenPending_ShouldMarkExpiredWithReason()
    {
        var purchase = ChipPurchase.Request(Guid.NewGuid(), 500m, Now);

        purchase.Expire(Now.AddMinutes(15));

        Assert.Equal(ChipPurchaseStatus.Expired, purchase.Status);
        Assert.Equal("Purchase timed out", purchase.RejectionReason);
        Assert.Equal(Now.AddMinutes(15), purchase.ResolvedOn);
    }

    [Fact]
    public void Expire_WhenNotPending_ShouldThrow()
    {
        var purchase = ChipPurchase.Request(Guid.NewGuid(), 500m, Now);
        purchase.Complete(Now);

        Assert.Throws<CasinoExceptions.InvalidPurchaseStateTransitionException>(() => purchase.Expire(Now));
    }
}

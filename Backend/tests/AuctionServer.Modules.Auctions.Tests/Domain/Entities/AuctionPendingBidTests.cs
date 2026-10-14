using AuctionServer.Modules.Auctions.Domain.Entities;
using AuctionServer.Modules.Auctions.Domain.Exceptions;

namespace AuctionServer.Modules.Auctions.Tests.Domain.Entities;

public class AuctionPendingBidTests
{
    private static Auction CreateActiveAuction(decimal startingPrice = 1m)
    {
        var auction = Auction.Create(Guid.NewGuid(), Guid.NewGuid(), startingPrice, DateTime.UtcNow.AddMinutes(10));
        auction.Activate("Seeded Item", "Common", 10m);
        return auction;
    }

    [Fact]
    public void RequestBid_WhenAuctionIsActive_ShouldStorePendingBidWithoutChangingLeader()
    {
        var auction = CreateActiveAuction();
        var versionBefore = auction.Version;
        var bidderId = Guid.NewGuid();

        auction.RequestBid(bidderId, 100m);

        Assert.Equal(bidderId, auction.PendingBidderId);
        Assert.Equal(100m, auction.PendingBidAmount);
        Assert.Null(auction.CurrentWinningUserId);
        Assert.Equal(1m, auction.CurrentPrice);
        Assert.NotEqual(versionBefore, auction.Version);
    }

    [Fact]
    public void RequestBid_WhenAnotherBidIsPending_ShouldThrowBidInProgressException()
    {
        var auction = CreateActiveAuction();
        auction.RequestBid(Guid.NewGuid(), 100m);

        Assert.Throws<AuctionExceptions.BidInProgressException>(() => auction.RequestBid(Guid.NewGuid(), 200m));
        Assert.Equal(100m, auction.PendingBidAmount);
    }

    [Fact]
    public void RequestBid_WhenAmountIsNotHigherThanCurrentPrice_ShouldThrowInvalidBidException()
    {
        var auction = CreateActiveAuction(startingPrice: 100m);

        Assert.Throws<AuctionExceptions.InvalidBidException>(() => auction.RequestBid(Guid.NewGuid(), 100m));
    }

    [Fact]
    public void RequestBid_WhenBidderIsSeller_ShouldThrowCannotBidOwnItemException()
    {
        var sellerId = Guid.NewGuid();
        var auction = Auction.Create(sellerId, Guid.NewGuid(), 1m, DateTime.UtcNow.AddMinutes(10));
        auction.Activate("Seeded Item", "Common", 10m);

        Assert.Throws<AuctionExceptions.CannotBidOwnItemException>(() => auction.RequestBid(sellerId, 100m));
    }

    [Fact]
    public void RequestBid_WhenBidderIsCurrentLeader_ShouldThrowAlreadyHighestBidderException()
    {
        var auction = CreateActiveAuction();
        var bidderId = Guid.NewGuid();
        auction.RequestBid(bidderId, 100m);
        auction.ConfirmPendingBid();

        Assert.Throws<AuctionExceptions.AlreadyHighestBidderException>(() => auction.RequestBid(bidderId, 200m));
    }

    [Fact]
    public void RequestBid_WhenAuctionIsPending_ShouldThrowAuctionNotActiveException()
    {
        var auction = Auction.Create(Guid.NewGuid(), Guid.NewGuid(), 1m, DateTime.UtcNow.AddMinutes(10));

        Assert.Throws<AuctionExceptions.AuctionNotActiveException>(() => auction.RequestBid(Guid.NewGuid(), 100m));
    }

    [Fact]
    public void ConfirmPendingBid_ShouldPromoteLeaderAndClearPending()
    {
        var auction = CreateActiveAuction();
        var bidderId = Guid.NewGuid();
        auction.RequestBid(bidderId, 100m);

        auction.ConfirmPendingBid();

        Assert.Equal(bidderId, auction.CurrentWinningUserId);
        Assert.Equal(100m, auction.CurrentPrice);
        Assert.Null(auction.PendingBidderId);
        Assert.Null(auction.PendingBidAmount);
    }

    [Fact]
    public void ConfirmPendingBid_WhenNoPendingBid_ShouldThrowNoPendingBidException()
    {
        var auction = CreateActiveAuction();

        Assert.Throws<AuctionExceptions.NoPendingBidException>(() => auction.ConfirmPendingBid());
    }

    [Fact]
    public void ConfirmPendingBid_WhenAuctionIsClosed_ShouldThrowInvalidAuctionStateTransitionException()
    {
        var auction = CreateActiveAuction();
        auction.RequestBid(Guid.NewGuid(), 100m);
        auction.CloseAuction();

        Assert.Throws<AuctionExceptions.InvalidAuctionStateTransitionException>(() => auction.ConfirmPendingBid());
        Assert.Null(auction.CurrentWinningUserId);
    }

    [Fact]
    public void RejectPendingBid_ShouldClearPendingAndKeepLeader()
    {
        var auction = CreateActiveAuction();
        auction.RequestBid(Guid.NewGuid(), 100m);

        auction.RejectPendingBid();

        Assert.Null(auction.PendingBidderId);
        Assert.Null(auction.PendingBidAmount);
        Assert.Null(auction.CurrentWinningUserId);
        Assert.Equal(1m, auction.CurrentPrice);
    }

    [Fact]
    public void RejectPendingBid_WhenNoPendingBid_ShouldThrowNoPendingBidException()
    {
        var auction = CreateActiveAuction();

        Assert.Throws<AuctionExceptions.NoPendingBidException>(() => auction.RejectPendingBid());
    }

    [Fact]
    public void RejectPendingBid_WhenAuctionWasClosed_ShouldStillClearPending()
    {
        var auction = CreateActiveAuction();
        auction.RequestBid(Guid.NewGuid(), 100m);
        auction.CloseAuction();

        auction.RejectPendingBid();

        Assert.Null(auction.PendingBidderId);
        Assert.Null(auction.PendingBidAmount);
    }
}

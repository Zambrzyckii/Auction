using AuctionServer.Modules.Auctions.Domain.Entities;
using AuctionServer.Modules.Auctions.Domain.Exceptions;

namespace AuctionServer.Modules.Auctions.Tests.Domain.Entities;

public class AuctionBidTests
{
    private static Auction CreateAuction(Guid? sellerId = null, decimal startingPrice = 50m) =>
        Auction.Create(sellerId ?? Guid.NewGuid(), Guid.NewGuid(), startingPrice, DateTime.UtcNow.AddMinutes(10));

    [Fact]
    public void ApplyNewBid_WhenSellerBidsOwnAuction_ShouldThrow()
    {
        var sellerId = Guid.NewGuid();
        var auction = CreateAuction(sellerId);

        Assert.Throws<AuctionExceptions.CannotBidOwnItemException>(() => auction.ApplyNewBid(sellerId, 100m));
    }

    [Fact]
    public void ApplyNewBid_WhenBidderIsAlreadyHighest_ShouldThrow()
    {
        var auction = CreateAuction();
        var bidderId = Guid.NewGuid();
        auction.ApplyNewBid(bidderId, 100m);

        Assert.Throws<AuctionExceptions.AlreadyHighestBidderException>(() => auction.ApplyNewBid(bidderId, 150m));
    }

    [Fact]
    public void ApplyNewBid_WhenAmountEqualsCurrentPrice_ShouldThrow()
    {
        var auction = CreateAuction(startingPrice: 50m);

        Assert.Throws<AuctionExceptions.InvalidBidException>(() => auction.ApplyNewBid(Guid.NewGuid(), 50m));
    }

    [Fact]
    public void ApplyNewBid_ShouldSetWinnerAndRegenerateVersion()
    {
        var auction = CreateAuction();
        var bidderId = Guid.NewGuid();
        var versionBefore = auction.Version;

        auction.ApplyNewBid(bidderId, 100m);

        Assert.Equal(bidderId, auction.CurrentWinningUserId);
        Assert.Equal(100m, auction.CurrentPrice);
        Assert.NotEqual(versionBefore, auction.Version);
    }

    [Fact]
    public void ApplyNewBid_WhenFarFromEnd_ShouldNotExtendEndsOn()
    {
        var auction = CreateAuction();
        var endsOnBefore = auction.EndsOn;

        auction.ApplyNewBid(Guid.NewGuid(), 100m);

        Assert.Equal(endsOnBefore, auction.EndsOn);
    }

    [Fact]
    public void CloseAuction_ShouldSetClosedAndRegenerateVersion()
    {
        var auction = CreateAuction();
        var versionBefore = auction.Version;

        auction.CloseAuction();

        Assert.True(auction.IsClosed);
        Assert.NotEqual(versionBefore, auction.Version);
    }
}

using AuctionServer.Modules.Auctions.Domain.Entities;
using AuctionServer.Modules.Auctions.Domain.Exceptions;

namespace AuctionServer.Modules.Auctions.Tests.Domain.Entities;

public class AuctionTests
{
    [Fact]
    public void ApplyNewBid_WhenAmountIsHigher_ShouldUpdateCurrentPrice()
    {
        var auction = new Auction();
        decimal newValidBid = 100m;
        
        auction.ApplyNewBid(Guid.NewGuid(), newValidBid);
        
        Assert.Equal(newValidBid, auction.CurrentPrice);
    }

    [Fact]
    public void ApplyNewBid_WhenAmountIsLower_ShouldThrowInvalidBidException()
    {
        var auction = new Auction();
        decimal currentBid = 100m;
        auction.ApplyNewBid(Guid.NewGuid(),currentBid);

        decimal newLowerBid = 10m;

        Assert.Throws<AuctionExceptions.InvalidBidException>(() => auction.ApplyNewBid(Guid.NewGuid(),newLowerBid));
        Assert.Equal(currentBid, auction.CurrentPrice);
    }

    [Fact]
    public void ApplyNewBid_WhenAuctionIsClosed_ShouldThrowAuctionClosedException()
    {
        var auction = new Auction();
        var currentBid = 100m;
        auction.ApplyNewBid(Guid.NewGuid(),currentBid);
        auction.CloseAuction();
        var newBidAfterClosingAuction = 200m;

        Assert.Throws<AuctionExceptions.AuctionClosedException>(() => auction.ApplyNewBid(Guid.NewGuid(),newBidAfterClosingAuction));
        Assert.Equal(currentBid, auction.CurrentPrice);
    }
}
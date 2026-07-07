using AuctionServer.Modules.Auctions.Domain.Entities;

namespace AuctionServer.Modules.Auctions.Tests.Domain.Entities;

public class AuctionTests
{
    [Fact]
    public void ApplyNewBid_WhenAmountIsHigher_ShouldUpdateCurrentPrice()
    {
        var auction = new Auction();
        decimal newValidBid = 100m;
        
        auction.ApplyNewBid(newValidBid);
        
        Assert.Equal(newValidBid, auction.CurrentPrice);
    }

    [Fact]
    public void ApplyNewBid_WhenAmountIsLower_ShouldNotUpdateCurrentPrice()
    {
        var auction = new Auction();
        decimal currentBid = 100m;
        auction.ApplyNewBid(currentBid);
        
        decimal newLowerBid = 10m;
        auction.ApplyNewBid(newLowerBid);
        
        Assert.Equal(auction.CurrentPrice, currentBid); 
    }

    [Fact]
    public void ApplyNewBid_WhenAuctionIsClosed_ShouldNotUpdateCurrentPrice()
    {
        var auction = new Auction();
        var currentBid = 100m;
        auction.ApplyNewBid(currentBid);
        auction.CloseAuction();
        var newBidAfterClosingAuction = 200m;
        auction.ApplyNewBid(newBidAfterClosingAuction);
        
        Assert.Equal(auction.CurrentPrice, currentBid);
    }
}
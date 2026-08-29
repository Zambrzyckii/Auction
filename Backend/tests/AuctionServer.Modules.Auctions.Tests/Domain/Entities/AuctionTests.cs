using AuctionServer.Modules.Auctions.Domain.Entities;
using AuctionServer.Modules.Auctions.Domain.Exceptions;

namespace AuctionServer.Modules.Auctions.Tests.Domain.Entities;

public class AuctionTests
{
    private static Auction CreateAuction()
    {
        var auction = Auction.Create(Guid.NewGuid(), Guid.NewGuid(), 1m, DateTime.UtcNow.AddMinutes(10));
        auction.Activate("Seeded Item", "Common", 10m);
        return auction;
    }

    [Fact]
    public void ApplyNewBid_WhenAmountIsHigher_ShouldUpdateCurrentPrice()
    {
        var auction = CreateAuction();
        decimal newValidBid = 100m;
        
        auction.ApplyNewBid(Guid.NewGuid(), newValidBid);
        
        Assert.Equal(newValidBid, auction.CurrentPrice);
    }

    [Fact]
    public void ApplyNewBid_WhenAmountIsLower_ShouldThrowInvalidBidException()
    {
        var auction = CreateAuction();
        decimal currentBid = 100m;
        auction.ApplyNewBid(Guid.NewGuid(),currentBid);

        decimal newLowerBid = 10m;

        Assert.Throws<AuctionExceptions.InvalidBidException>(() => auction.ApplyNewBid(Guid.NewGuid(),newLowerBid));
        Assert.Equal(currentBid, auction.CurrentPrice);
    }

    [Fact]
    public void ApplyNewBid_WhenAuctionIsClosed_ShouldThrowAuctionClosedException()
    {
        var auction = CreateAuction();
        var currentBid = 100m;
        auction.ApplyNewBid(Guid.NewGuid(),currentBid);
        auction.CloseAuction();
        var newBidAfterClosingAuction = 200m;

        Assert.Throws<AuctionExceptions.AuctionClosedException>(() => auction.ApplyNewBid(Guid.NewGuid(),newBidAfterClosingAuction));
        Assert.Equal(currentBid, auction.CurrentPrice);
    }
}
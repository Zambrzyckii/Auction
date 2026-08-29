using AuctionServer.Modules.Auctions.Domain.Entities;
using AuctionServer.Modules.Auctions.Domain.Enums;
using AuctionServer.Modules.Auctions.Domain.Exceptions;

namespace AuctionServer.Modules.Auctions.Tests.Domain.Entities;

public class AuctionFactoryTests
{
    [Fact]
    public void Create_WhenArgumentsAreValid_ShouldSetProperties()
    {
        var sellerId = Guid.NewGuid();
        var itemId = Guid.NewGuid();
        var endsOn = DateTime.UtcNow.AddHours(1);

        var auction = Auction.Create(sellerId, itemId, 75m, endsOn);

        Assert.Equal(sellerId, auction.SellerUserId);
        Assert.Equal(itemId, auction.ItemId);
        Assert.Equal(75m, auction.CurrentPrice);
        Assert.Equal(endsOn, auction.EndsOn);
        Assert.Equal(AuctionStatus.Pending, auction.Status);
        Assert.Null(auction.ItemName);
        Assert.Null(auction.CurrentWinningUserId);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-10)]
    public void Create_WhenStartingPriceIsNotPositive_ShouldThrow(decimal startingPrice)
    {
        Assert.Throws<AuctionExceptions.InvalidStartingPriceException>(
            () => Auction.Create(Guid.NewGuid(), Guid.NewGuid(), startingPrice, DateTime.UtcNow.AddHours(1)));
    }

    [Fact]
    public void Create_WhenEndsOnIsLessThanMinuteAway_ShouldThrow()
    {
        Assert.Throws<AuctionExceptions.InvalidAuctionEndDateException>(
            () => Auction.Create(Guid.NewGuid(), Guid.NewGuid(), 50m, DateTime.UtcNow.AddSeconds(30)));
    }

    [Fact]
    public void Create_WhenEndsOnIsInThePast_ShouldThrow()
    {
        Assert.Throws<AuctionExceptions.InvalidAuctionEndDateException>(
            () => Auction.Create(Guid.NewGuid(), Guid.NewGuid(), 50m, DateTime.UtcNow.AddMinutes(-5)));
    }
}

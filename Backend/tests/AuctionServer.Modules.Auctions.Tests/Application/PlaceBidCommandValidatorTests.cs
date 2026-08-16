using AuctionServer.Modules.Auctions.Application.Commands.PlaceBid;

namespace AuctionServer.Modules.Auctions.Tests.Application;

public class PlaceBidCommandValidatorTests
{
    private readonly PlaceBidCommandValidator _validator = new();

    [Fact]
    public void Validate_WhenCommandIsValid_ShouldPass()
    {
        var result = _validator.Validate(new PlaceBidCommand(Guid.NewGuid(), Guid.NewGuid(), 100m));

        Assert.True(result.IsValid);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    public void Validate_WhenPriceIsNotPositive_ShouldFail(decimal price)
    {
        var result = _validator.Validate(new PlaceBidCommand(Guid.NewGuid(), Guid.NewGuid(), price));

        Assert.False(result.IsValid);
    }

    [Fact]
    public void Validate_WhenAuctionIdIsEmpty_ShouldFail()
    {
        var result = _validator.Validate(new PlaceBidCommand(Guid.Empty, Guid.NewGuid(), 100m));

        Assert.False(result.IsValid);
    }
}

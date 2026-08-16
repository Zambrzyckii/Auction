using AuctionServer.Modules.Auctions.Application.Commands.CreateAuction;

namespace AuctionServer.Modules.Auctions.Tests.Application;

public class CreateAuctionCommandValidatorTests
{
    private readonly CreateAuctionCommandValidator _validator = new();

    private static CreateAuctionCommand ValidCommand(
        decimal startingPrice = 50m,
        DateTimeOffset? endsOn = null) =>
        new(Guid.NewGuid(), Guid.NewGuid(), startingPrice, endsOn ?? DateTimeOffset.UtcNow.AddDays(1));

    [Fact]
    public void Validate_WhenCommandIsValid_ShouldPass()
    {
        var result = _validator.Validate(ValidCommand());

        Assert.True(result.IsValid);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-5)]
    public void Validate_WhenStartingPriceIsNotPositive_ShouldFail(decimal price)
    {
        var result = _validator.Validate(ValidCommand(startingPrice: price));

        Assert.False(result.IsValid);
    }

    [Fact]
    public void Validate_WhenEndsOnIsInThePast_ShouldFail()
    {
        var result = _validator.Validate(ValidCommand(endsOn: DateTimeOffset.UtcNow.AddMinutes(-1)));

        Assert.False(result.IsValid);
    }

    [Fact]
    public void Validate_WhenEndsOnIsMoreThanThirtyDaysAway_ShouldFail()
    {
        var result = _validator.Validate(ValidCommand(endsOn: DateTimeOffset.UtcNow.AddDays(40)));

        Assert.False(result.IsValid);
    }

    [Fact]
    public void Validate_WhenItemIdIsEmpty_ShouldFail()
    {
        var command = new CreateAuctionCommand(Guid.NewGuid(), Guid.Empty, 50m, DateTimeOffset.UtcNow.AddDays(1));

        var result = _validator.Validate(command);

        Assert.False(result.IsValid);
    }
}

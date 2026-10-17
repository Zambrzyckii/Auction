using AuctionServer.Modules.Casino.Application.Command.PurchaseChips;

namespace AuctionServer.Modules.Casino.Tests.Application;

public class PurchaseChipsCommandValidatorTests
{
    private readonly PurchaseChipsCommandValidator _validator = new();

    [Fact]
    public void Validate_WithWholeAmount_ShouldPass() =>
        Assert.True(_validator.Validate(new PurchaseChipsCommand(Guid.NewGuid(), 500m)).IsValid);

    [Theory]
    [InlineData(0)]
    [InlineData(-10)]
    [InlineData(10.5)]
    public void Validate_WhenAmountIsNotPositiveWhole_ShouldFail(decimal amount) =>
        Assert.False(_validator.Validate(new PurchaseChipsCommand(Guid.NewGuid(), amount)).IsValid);

    [Fact]
    public void Validate_WhenUserIdEmpty_ShouldFail() =>
        Assert.False(_validator.Validate(new PurchaseChipsCommand(Guid.Empty, 500m)).IsValid);
}

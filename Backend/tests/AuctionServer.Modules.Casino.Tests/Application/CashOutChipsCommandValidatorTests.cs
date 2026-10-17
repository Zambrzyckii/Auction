using AuctionServer.Modules.Casino.Application.Command.CashOutChips;

namespace AuctionServer.Modules.Casino.Tests.Application;

public class CashOutChipsCommandValidatorTests
{
    private readonly CashOutChipsCommandValidator _validator = new();

    [Fact]
    public void Validate_WithHalfChipAmount_ShouldPass() =>
        Assert.True(_validator.Validate(new CashOutChipsCommand(Guid.NewGuid(), 12.5m)).IsValid);

    [Theory]
    [InlineData(0)]
    [InlineData(-5)]
    [InlineData(0.005)]
    public void Validate_WhenAmountIsNotPositiveOrBeyondCents_ShouldFail(decimal amount) =>
        Assert.False(_validator.Validate(new CashOutChipsCommand(Guid.NewGuid(), amount)).IsValid);

    [Fact]
    public void Validate_WhenUserIdEmpty_ShouldFail() =>
        Assert.False(_validator.Validate(new CashOutChipsCommand(Guid.Empty, 10m)).IsValid);
}

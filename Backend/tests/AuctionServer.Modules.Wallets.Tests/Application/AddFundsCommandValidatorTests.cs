using AuctionServer.Modules.Wallets.Application.Command.AddFunds;

namespace AuctionServer.Modules.Wallets.Tests.Application;

public class AddFundsCommandValidatorTests
{
    private readonly AddFundsCommandValidator _validator = new();

    [Fact]
    public void Validate_WhenCommandIsValid_ShouldPass()
    {
        var result = _validator.Validate(new AddFundsCommand(Guid.NewGuid(), 100m));

        Assert.True(result.IsValid);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-100)]
    public void Validate_WhenAmountIsNotPositive_ShouldFail(decimal amount)
    {
        var result = _validator.Validate(new AddFundsCommand(Guid.NewGuid(), amount));

        Assert.False(result.IsValid);
    }
}

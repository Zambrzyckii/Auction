using AuctionServer.Modules.Wallets.Application.Command.TransferFunds;

namespace AuctionServer.Modules.Wallets.Tests.Application;

public class TransferFundsCommandValidatorTests
{
    private readonly TransferFundsCommandValidator _validator = new();

    [Fact]
    public void Validate_WhenCommandIsValid_ShouldPass()
    {
        var result = _validator.Validate(new TransferFundsCommand(Guid.NewGuid(), Guid.NewGuid(), 100m));

        Assert.True(result.IsValid);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-100)]
    public void Validate_WhenAmountIsNotPositive_ShouldFail(decimal amount)
    {
        var result = _validator.Validate(new TransferFundsCommand(Guid.NewGuid(), Guid.NewGuid(), amount));

        Assert.False(result.IsValid);
    }

    [Fact]
    public void Validate_WhenRecipientIsEmpty_ShouldFail()
    {
        var result = _validator.Validate(new TransferFundsCommand(Guid.NewGuid(), Guid.Empty, 100m));

        Assert.False(result.IsValid);
    }

    [Fact]
    public void Validate_WhenRecipientIsTheSender_ShouldFail()
    {
        var userId = Guid.NewGuid();

        var result = _validator.Validate(new TransferFundsCommand(userId, userId, 100m));

        Assert.False(result.IsValid);
    }
}

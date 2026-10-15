using AuctionServer.Modules.Banking.Application.Command.RepayLoan;

namespace AuctionServer.Modules.Banking.Tests.Application;

public class RepayLoanCommandValidatorTests
{
    private readonly RepayLoanCommandValidator _validator = new();

    [Fact]
    public void Validate_WhenCommandIsValid_ShouldPass()
    {
        var result = _validator.Validate(new RepayLoanCommand(Guid.NewGuid(), Guid.NewGuid()));

        Assert.True(result.IsValid);
    }

    [Fact]
    public void Validate_WhenLoanIdIsEmpty_ShouldFail()
    {
        var result = _validator.Validate(new RepayLoanCommand(Guid.NewGuid(), Guid.Empty));

        Assert.False(result.IsValid);
    }
}

using AuctionServer.Modules.Banking.Application.Command.CreateLoan;

namespace AuctionServer.Modules.Banking.Tests.Application;

public class CreateLoanCommandValidatorTests
{
    private readonly CreateLoanCommandValidator _validator = new();

    [Fact]
    public void Validate_WhenCommandIsValid_ShouldPass()
    {
        var result = _validator.Validate(new CreateLoanCommand(Guid.NewGuid(), "Quick"));

        Assert.True(result.IsValid);
    }

    [Fact]
    public void Validate_WhenOfferNameIsEmpty_ShouldFail()
    {
        var result = _validator.Validate(new CreateLoanCommand(Guid.NewGuid(), ""));

        Assert.False(result.IsValid);
    }

    [Fact]
    public void Validate_WhenOfferNameIsTooLong_ShouldFail()
    {
        var result = _validator.Validate(new CreateLoanCommand(Guid.NewGuid(), new string('x', 65)));

        Assert.False(result.IsValid);
    }
}

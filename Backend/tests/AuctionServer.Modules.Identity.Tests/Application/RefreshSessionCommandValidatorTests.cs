using AuctionServer.Modules.Identity.Application.Commands.RefreshSession;

namespace AuctionServer.Modules.Identity.Tests.Application;

public class RefreshSessionCommandValidatorTests
{
    private readonly RefreshSessionCommandValidator _validator = new();

    [Fact]
    public void Validate_WhenTokenIsPresent_ShouldPass()
    {
        var result = _validator.Validate(new RefreshSessionCommand(new string('a', 43)));

        Assert.True(result.IsValid);
    }

    [Fact]
    public void Validate_WhenTokenIsEmpty_ShouldFail()
    {
        var result = _validator.Validate(new RefreshSessionCommand(""));

        Assert.False(result.IsValid);
    }

    [Fact]
    public void Validate_WhenTokenIsLongerThan128Characters_ShouldFail()
    {
        var result = _validator.Validate(new RefreshSessionCommand(new string('a', 129)));

        Assert.False(result.IsValid);
    }
}

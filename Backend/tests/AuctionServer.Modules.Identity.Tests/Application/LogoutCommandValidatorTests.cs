using AuctionServer.Modules.Identity.Application.Commands.Logout;

namespace AuctionServer.Modules.Identity.Tests.Application;

public class LogoutCommandValidatorTests
{
    private readonly LogoutCommandValidator _validator = new();

    [Fact]
    public void Validate_WhenTokenIsPresent_ShouldPass()
    {
        var result = _validator.Validate(new LogoutCommand(new string('a', 43)));

        Assert.True(result.IsValid);
    }

    [Fact]
    public void Validate_WhenTokenIsEmpty_ShouldFail()
    {
        var result = _validator.Validate(new LogoutCommand(""));

        Assert.False(result.IsValid);
    }
}

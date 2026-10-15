using AuctionServer.Modules.Pawnshop.Application.Command.OpenPawnshop;

namespace AuctionServer.Modules.Pawnshop.Tests.Application;

public class OpenPawnshopCommandValidatorTests
{
    private readonly OpenPawnshopCommandValidator _validator = new();

    [Fact]
    public void Validate_WhenUserIdEmpty_ShouldFail() =>
        Assert.False(_validator.Validate(new OpenPawnshopCommand(Guid.Empty)).IsValid);

    [Fact]
    public void Validate_WithUserId_ShouldPass() =>
        Assert.True(_validator.Validate(new OpenPawnshopCommand(Guid.NewGuid())).IsValid);
}

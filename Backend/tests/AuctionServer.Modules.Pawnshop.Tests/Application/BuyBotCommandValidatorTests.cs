using AuctionServer.Modules.Pawnshop.Application.Command.BuyBot;

namespace AuctionServer.Modules.Pawnshop.Tests.Application;

public class BuyBotCommandValidatorTests
{
    private readonly BuyBotCommandValidator _validator = new();

    [Fact]
    public void Validate_WhenUserIdEmpty_ShouldFail() =>
        Assert.False(_validator.Validate(new BuyBotCommand(Guid.Empty, "Pawn Clerk")).IsValid);

    [Fact]
    public void Validate_WhenTierNameEmpty_ShouldFail() =>
        Assert.False(_validator.Validate(new BuyBotCommand(Guid.NewGuid(), "")).IsValid);

    [Fact]
    public void Validate_WhenTierNameTooLong_ShouldFail() =>
        Assert.False(_validator.Validate(new BuyBotCommand(Guid.NewGuid(), new string('x', 65))).IsValid);

    [Fact]
    public void Validate_WithValidCommand_ShouldPass() =>
        Assert.True(_validator.Validate(new BuyBotCommand(Guid.NewGuid(), "Pawn Clerk")).IsValid);
}

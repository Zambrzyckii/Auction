using AuctionServer.Modules.Inventory.Application.Command.GrantItem;
using AuctionServer.Modules.Inventory.Domain.Enums;

namespace AuctionServer.Modules.Inventory.Tests.Application;

public class GrantItemCommandValidatorTests
{
    private readonly GrantItemCommandValidator _validator = new();

    [Fact]
    public void Validate_WhenCommandIsValid_ShouldPass()
    {
        var result = _validator.Validate(new GrantItemCommand(Guid.NewGuid(), "Sword", ItemRarity.Common));

        Assert.True(result.IsValid);
    }

    [Fact]
    public void Validate_WhenOwnerIdIsEmpty_ShouldFail()
    {
        var result = _validator.Validate(new GrantItemCommand(Guid.Empty, "Sword", ItemRarity.Common));

        Assert.False(result.IsValid);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public void Validate_WhenNameIsBlank_ShouldFail(string name)
    {
        var result = _validator.Validate(new GrantItemCommand(Guid.NewGuid(), name, ItemRarity.Common));

        Assert.False(result.IsValid);
    }

    [Fact]
    public void Validate_WhenNameIsTooLong_ShouldFail()
    {
        var result = _validator.Validate(new GrantItemCommand(Guid.NewGuid(), new string('x', 101), ItemRarity.Common));

        Assert.False(result.IsValid);
    }

    [Fact]
    public void Validate_WhenRarityIsOutsideEnum_ShouldFail()
    {
        var result = _validator.Validate(new GrantItemCommand(Guid.NewGuid(), "Sword", (ItemRarity)99));

        Assert.False(result.IsValid);
    }
}

using AuctionServer.Modules.Inventory.Application.Command.SellItemToShop;

namespace AuctionServer.Modules.Inventory.Tests.Application;

public class SellItemToShopCommandValidatorTests
{
    private readonly SellItemToShopCommandValidator _validator = new();

    [Fact]
    public void Validate_WhenCommandIsValid_ShouldPass()
    {
        var result = _validator.Validate(new SellItemToShopCommand(Guid.NewGuid(), Guid.NewGuid()));

        Assert.True(result.IsValid);
    }

    [Fact]
    public void Validate_WhenOwnerIdIsEmpty_ShouldFail()
    {
        var result = _validator.Validate(new SellItemToShopCommand(Guid.Empty, Guid.NewGuid()));

        Assert.False(result.IsValid);
    }

    [Fact]
    public void Validate_WhenItemIdIsEmpty_ShouldFail()
    {
        var result = _validator.Validate(new SellItemToShopCommand(Guid.NewGuid(), Guid.Empty));

        Assert.False(result.IsValid);
    }
}

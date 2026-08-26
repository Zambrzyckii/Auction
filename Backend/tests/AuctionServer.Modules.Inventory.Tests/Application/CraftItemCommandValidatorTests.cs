using AuctionServer.Modules.Inventory.Application.Command.CraftItem;

namespace AuctionServer.Modules.Inventory.Tests.Application;

public class CraftItemCommandValidatorTests
{
    private readonly CraftItemCommandValidator _validator = new();

    private static List<Guid> Ids(int count) => Enumerable.Range(0, count).Select(_ => Guid.NewGuid()).ToList();

    [Fact]
    public void Validate_WhenCommandIsValid_ShouldPass()
    {
        var result = _validator.Validate(new CraftItemCommand(Guid.NewGuid(), Ids(3)));

        Assert.True(result.IsValid);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(2)]
    [InlineData(4)]
    public void Validate_WhenIngredientCountIsNotThree_ShouldFail(int count)
    {
        var result = _validator.Validate(new CraftItemCommand(Guid.NewGuid(), Ids(count)));

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.ErrorMessage.Contains("exactly 3"));
    }

    [Fact]
    public void Validate_WhenIngredientsContainDuplicates_ShouldFail()
    {
        var duplicated = Guid.NewGuid();
        var result = _validator.Validate(new CraftItemCommand(Guid.NewGuid(), [duplicated, duplicated, Guid.NewGuid()]));

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.ErrorMessage.Contains("distinct"));
    }

    [Fact]
    public void Validate_WhenIngredientsAreNull_ShouldFailWithoutThrowing()
    {
        var result = _validator.Validate(new CraftItemCommand(Guid.NewGuid(), null!));

        Assert.False(result.IsValid);
        var error = Assert.Single(result.Errors);
        Assert.Equal(nameof(CraftItemCommand.IngredientsIds), error.PropertyName);
    }

    [Fact]
    public void Validate_WhenAnyIngredientIdIsEmpty_ShouldFail()
    {
        var result = _validator.Validate(new CraftItemCommand(Guid.NewGuid(), [Guid.NewGuid(), Guid.Empty, Guid.NewGuid()]));

        Assert.False(result.IsValid);
    }

    [Fact]
    public void Validate_WhenOwnerIdIsEmpty_ShouldFail()
    {
        var result = _validator.Validate(new CraftItemCommand(Guid.Empty, Ids(3)));

        Assert.False(result.IsValid);
    }
}

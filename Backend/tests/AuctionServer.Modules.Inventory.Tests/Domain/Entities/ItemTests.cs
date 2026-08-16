using AuctionServer.Modules.Inventory.Domain.Entities;
using AuctionServer.Modules.Inventory.Domain.Enums;
using AuctionServer.Modules.Inventory.Domain.Exceptions;

namespace AuctionServer.Modules.Inventory.Tests.Domain.Entities;

public class ItemTests
{
    private static Item CreateItem(ItemRarity rarity = ItemRarity.Common, Guid? ownerId = null) =>
        Item.Create(ownerId ?? Guid.NewGuid(), "Test Item", rarity);

    private static List<Item> CreateIngredients(ItemRarity rarity, Guid ownerId, int count = 3) =>
        Enumerable.Range(0, count).Select(_ => CreateItem(rarity, ownerId)).ToList();

    [Fact]
    public void Create_ShouldSetOwnerRarityAndAvailableStatus()
    {
        var ownerId = Guid.NewGuid();

        var item = Item.Create(ownerId, "Sword", ItemRarity.Rare);

        Assert.Equal(ownerId, item.OwnerUserId);
        Assert.Equal("Sword", item.Name);
        Assert.Equal(ItemRarity.Rare, item.Rarity);
        Assert.Equal(ItemStatus.Available, item.Status);
        Assert.NotEqual(Guid.Empty, item.PublicItemId);
    }

    [Theory]
    [InlineData(ItemRarity.Common, 10, 99)]
    [InlineData(ItemRarity.Rare, 100, 999)]
    [InlineData(ItemRarity.Epic, 1_000, 9_999)]
    [InlineData(ItemRarity.Legendary, 10_000, 99_999)]
    public void Create_ShouldRollPriceWithinRarityRange(ItemRarity rarity, decimal min, decimal max)
    {
        var item = CreateItem(rarity);

        Assert.InRange(item.OfficialPrice, min, max);
    }

    [Theory]
    [InlineData(ItemRarity.Common, ItemRarity.Rare)]
    [InlineData(ItemRarity.Rare, ItemRarity.Epic)]
    [InlineData(ItemRarity.Epic, ItemRarity.Legendary)]
    public void Craft_WhenIngredientsValid_ShouldReturnItemOfNextRarity(ItemRarity input, ItemRarity expected)
    {
        var ownerId = Guid.NewGuid();
        var ingredients = CreateIngredients(input, ownerId);

        var crafted = Item.Craft(ingredients);

        Assert.Equal(expected, crafted.Rarity);
        Assert.Equal(ItemStatus.Available, crafted.Status);
    }

    [Fact]
    public void Craft_WhenIngredientsValid_ShouldConsumeAllIngredients()
    {
        var ingredients = CreateIngredients(ItemRarity.Common, Guid.NewGuid());

        Item.Craft(ingredients);

        Assert.All(ingredients, i => Assert.Equal(ItemStatus.Consumed, i.Status));
    }

    [Fact]
    public void Craft_WhenIngredientsValid_ShouldAssignIngredientsOwner()
    {
        var ownerId = Guid.NewGuid();
        var ingredients = CreateIngredients(ItemRarity.Common, ownerId);

        var crafted = Item.Craft(ingredients);

        Assert.Equal(ownerId, crafted.OwnerUserId);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(2)]
    [InlineData(4)]
    public void Craft_WhenIngredientCountIsNotThree_ShouldThrow(int count)
    {
        var ingredients = CreateIngredients(ItemRarity.Common, Guid.NewGuid(), count);

        Assert.Throws<InventoryException.NotEnoughIngredientsToCraftException>(() => Item.Craft(ingredients));
    }

    [Fact]
    public void Craft_WhenIngredientsHaveMixedRarities_ShouldThrow()
    {
        var ownerId = Guid.NewGuid();
        var ingredients = new List<Item>
        {
            CreateItem(ItemRarity.Common, ownerId),
            CreateItem(ItemRarity.Common, ownerId),
            CreateItem(ItemRarity.Rare, ownerId)
        };

        Assert.Throws<InventoryException.IngredientsRarityMismatchException>(() => Item.Craft(ingredients));
    }

    [Fact]
    public void Craft_WhenIngredientsHaveDifferentOwners_ShouldThrow()
    {
        var ownerId = Guid.NewGuid();
        var ingredients = new List<Item>
        {
            CreateItem(ItemRarity.Common, ownerId),
            CreateItem(ItemRarity.Common, ownerId),
            CreateItem(ItemRarity.Common, Guid.NewGuid())
        };

        Assert.Throws<InventoryException.IngredientsOwnerMismatchException>(() => Item.Craft(ingredients));
    }

    [Fact]
    public void Craft_WhenIngredientsAreLegendary_ShouldThrow()
    {
        var ingredients = CreateIngredients(ItemRarity.Legendary, Guid.NewGuid());

        Assert.Throws<InventoryException.CannotCraftFromLegendaryException>(() => Item.Craft(ingredients));
    }

    [Fact]
    public void Craft_WhenIngredientIsLocked_ShouldThrow()
    {
        var ownerId = Guid.NewGuid();
        var ingredients = CreateIngredients(ItemRarity.Common, ownerId);
        ingredients[0].LockItem();

        Assert.Throws<InventoryException.ItemNotAvailableException>(() => Item.Craft(ingredients));
    }

    [Fact]
    public void Craft_WhenIngredientIsAlreadyConsumed_ShouldThrow()
    {
        var ownerId = Guid.NewGuid();
        var consumed = CreateIngredients(ItemRarity.Common, ownerId);
        Item.Craft(consumed);
        var ingredients = new List<Item> { consumed[0], CreateItem(ItemRarity.Common, ownerId), CreateItem(ItemRarity.Common, ownerId) };

        Assert.Throws<InventoryException.ItemNotAvailableException>(() => Item.Craft(ingredients));
    }

    [Fact]
    public void Craft_WhenSameItemPassedThreeTimes_ShouldThrow()
    {
        var item = CreateItem();
        var ingredients = new List<Item> { item, item, item };

        Assert.Throws<InventoryException.ItemNotAvailableException>(() => Item.Craft(ingredients));
    }

    [Fact]
    public void LockItem_WhenAvailable_ShouldLockAndRegenerateVersion()
    {
        var item = CreateItem();
        var versionBefore = item.Version;

        item.LockItem();

        Assert.Equal(ItemStatus.LockedForAuction, item.Status);
        Assert.NotEqual(versionBefore, item.Version);
    }

    [Fact]
    public void LockItem_WhenAlreadyLocked_ShouldThrow()
    {
        var item = CreateItem();
        item.LockItem();

        Assert.Throws<InventoryException.ItemNotAvailableException>(() => item.LockItem());
    }

    [Fact]
    public void LockItem_WhenSoldToShop_ShouldThrow()
    {
        var item = CreateItem();
        item.SellToOfficialShop();

        Assert.Throws<InventoryException.ItemNotAvailableException>(() => item.LockItem());
    }

    [Fact]
    public void LockItem_WhenConsumed_ShouldThrow()
    {
        var ingredients = CreateIngredients(ItemRarity.Common, Guid.NewGuid());
        Item.Craft(ingredients);

        Assert.Throws<InventoryException.ItemNotAvailableException>(() => ingredients[0].LockItem());
    }

    [Fact]
    public void UnlockItem_WhenLocked_ShouldMakeAvailableAndRegenerateVersion()
    {
        var item = CreateItem();
        item.LockItem();
        var versionBefore = item.Version;

        item.UnlockItem();

        Assert.Equal(ItemStatus.Available, item.Status);
        Assert.NotEqual(versionBefore, item.Version);
    }

    [Fact]
    public void UnlockItem_WhenAvailable_ShouldThrow()
    {
        var item = CreateItem();

        Assert.Throws<InventoryException.ItemNotLockedException>(() => item.UnlockItem());
    }

    [Fact]
    public void UnlockItem_WhenSoldToShop_ShouldThrow()
    {
        var item = CreateItem();
        item.SellToOfficialShop();

        Assert.Throws<InventoryException.ItemNotLockedException>(() => item.UnlockItem());
    }

    [Fact]
    public void SellToOfficialShop_WhenAvailable_ShouldSetStatusAndRegenerateVersion()
    {
        var item = CreateItem();
        var versionBefore = item.Version;

        item.SellToOfficialShop();

        Assert.Equal(ItemStatus.SoldToShop, item.Status);
        Assert.NotEqual(versionBefore, item.Version);
    }

    [Fact]
    public void SellToOfficialShop_WhenLocked_ShouldThrow()
    {
        var item = CreateItem();
        item.LockItem();

        Assert.Throws<InventoryException.ItemNotAvailableException>(() => item.SellToOfficialShop());
    }

    [Fact]
    public void SellToOfficialShop_WhenAlreadySold_ShouldThrow()
    {
        var item = CreateItem();
        item.SellToOfficialShop();

        Assert.Throws<InventoryException.ItemNotAvailableException>(() => item.SellToOfficialShop());
    }
}

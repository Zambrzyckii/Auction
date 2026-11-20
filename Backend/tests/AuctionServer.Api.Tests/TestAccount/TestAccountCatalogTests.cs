using AuctionServer.Api.Infrastructure.TestAccount;
using AuctionServer.Modules.Inventory.Domain.Enums;

namespace AuctionServer.Api.Tests.TestAccount;

public class TestAccountCatalogTests
{
    [Fact]
    public void Items_ShouldHoldEachBotNameAndElevenFamilyItemsOnce()
    {
        Assert.Equal(171, TestAccountCatalog.Items.Count);
        Assert.Equal(171, TestAccountCatalog.Items.Select(item => item.Name).Distinct().Count());
    }

    [Theory]
    [InlineData("Chipped Diner Mug", ItemRarity.Common)]
    [InlineData("Signed Game Ball", ItemRarity.Epic)]
    [InlineData("Neon Diner Sign", ItemRarity.Legendary)]
    public void Items_ShouldKeepTheBotRarityLocks(string name, ItemRarity rarity)
    {
        Assert.Contains(new TestAccountItem(name, rarity), TestAccountCatalog.Items);
    }

    [Theory]
    [InlineData(ItemRarity.Common, 43)]
    [InlineData(ItemRarity.Rare, 38)]
    [InlineData(ItemRarity.Epic, 44)]
    [InlineData(ItemRarity.Legendary, 46)]
    public void Items_ShouldSpreadOpenNamesEvenlyOverRarities(ItemRarity rarity, int expected)
    {
        Assert.Equal(expected, TestAccountCatalog.Items.Count(item => item.Rarity == rarity));
    }

    [Fact]
    public void Items_ShouldNameFamiliesLikeTheModules()
    {
        Assert.Contains(new TestAccountItem("Warehouse Common Find", ItemRarity.Common), TestAccountCatalog.Items);
        Assert.Contains(new TestAccountItem("Pawned Legendary Good", ItemRarity.Legendary), TestAccountCatalog.Items);
        Assert.Contains(new TestAccountItem("Crafted Rare Item", ItemRarity.Rare), TestAccountCatalog.Items);
        Assert.DoesNotContain(TestAccountCatalog.Items, item => item.Name == "Crafted Common Item");
    }

    [Fact]
    public void Missing_WhenNothingIsOwned_ShouldListEveryItemCopiesTimes()
    {
        var missing = TestAccountCatalog.Missing([], 3);

        Assert.Equal(TestAccountCatalog.Items.Count * 3, missing.Count);
    }

    [Fact]
    public void Missing_ShouldSubtractOwnedCopies()
    {
        var first = TestAccountCatalog.Items[0];
        var second = TestAccountCatalog.Items[1];

        var missing = TestAccountCatalog.Missing([first, first, second], 2);

        Assert.DoesNotContain(first, missing);
        Assert.Single(missing, item => item == second);
        Assert.Equal(TestAccountCatalog.Items.Count * 2 - 3, missing.Count);
    }

    [Fact]
    public void Missing_ShouldCountOnlyExactCatalogMatches()
    {
        var otherRarity = new TestAccountItem("Chipped Diner Mug", ItemRarity.Epic);
        var starter = new TestAccountItem("Rusty Toolbox", ItemRarity.Common);

        var missing = TestAccountCatalog.Missing([otherRarity, starter], 1);

        Assert.Contains(new TestAccountItem("Chipped Diner Mug", ItemRarity.Common), missing);
        Assert.Equal(TestAccountCatalog.Items.Count, missing.Count);
    }

    [Fact]
    public void Missing_WhenMoreCopiesAreOwned_ShouldNotGoBelowZero()
    {
        var first = TestAccountCatalog.Items[0];

        var missing = TestAccountCatalog.Missing([first, first, first], 1);

        Assert.Equal(TestAccountCatalog.Items.Count - 1, missing.Count);
    }
}

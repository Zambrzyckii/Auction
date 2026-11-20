using AuctionServer.Modules.Inventory.Domain.Enums;

namespace AuctionServer.Api.Infrastructure.TestAccount;

public static class TestAccountCatalog
{
    public static IReadOnlyList<TestAccountItem> Items { get; } = Build();

    public static IReadOnlyList<TestAccountItem> Missing(IEnumerable<TestAccountItem> owned, int copies)
    {
        var ownedCounts = owned.CountBy(item => item).ToDictionary();

        return Items
            .SelectMany(item => Enumerable.Repeat(item, Math.Max(0, copies - ownedCounts.GetValueOrDefault(item))))
            .ToList();
    }

    private static List<TestAccountItem> Build()
    {
        var rarities = Enum.GetValues<ItemRarity>();
        var items = new List<TestAccountItem>();
        var openCount = 0;

        foreach (var name in TestAccountItemNames.Bots)
        {
            if (TestAccountItemNames.LockedRarities.TryGetValue(name, out var lockedRarity))
            {
                items.Add(new TestAccountItem(name, lockedRarity));
                continue;
            }

            items.Add(new TestAccountItem(name, rarities[openCount % rarities.Length]));
            openCount++;
        }

        items.AddRange(rarities.Select(rarity => new TestAccountItem($"Warehouse {rarity} Find", rarity)));
        items.AddRange(rarities.Select(rarity => new TestAccountItem($"Pawned {rarity} Good", rarity)));
        items.AddRange(rarities
            .Where(rarity => rarity != ItemRarity.Common)
            .Select(rarity => new TestAccountItem($"Crafted {rarity} Item", rarity)));

        return items;
    }
}

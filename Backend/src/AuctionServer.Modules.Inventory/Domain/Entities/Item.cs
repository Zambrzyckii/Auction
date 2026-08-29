using AuctionServer.Modules.Inventory.Domain.Enums;
using AuctionServer.Modules.Inventory.Domain.Exceptions;

namespace AuctionServer.Modules.Inventory.Domain.Entities;

public sealed class Item
{
    private const int CraftIngredientsCount = 3;

    public int Id { get; init; }
    public Guid PublicItemId { get; init; } = Guid.NewGuid();
    public Guid OwnerUserId { get; private set; }
    public required string Name { get; init; }
    public ItemRarity Rarity { get; private set; }
    public ItemStatus Status { get; private set; }
    public Guid Version { get; private set; } = Guid.NewGuid();
    public decimal OfficialPrice { get; private set; }
    public Guid? LockedForAuctionId { get; private set; }

    public static Item Create(Guid ownerUserId, string name, ItemRarity rarity)
    {
        var newItem = new Item
        {
            OwnerUserId = ownerUserId,
            Name = name,
            Rarity = rarity,
            Status = ItemStatus.Available,
            OfficialPrice = RollPriceFor(rarity)
        };

        return newItem;
    }

    public static Item Craft(IReadOnlyList<Item> ingredients)
    {
        if (ingredients.Count != CraftIngredientsCount)
            throw new InventoryException.NotEnoughIngredientsToCraftException();

        var first = ingredients[0];
        if (ingredients.Any(i => i.OwnerUserId != first.OwnerUserId))
            throw new InventoryException.IngredientsOwnerMismatchException();
        if (ingredients.Any(i => i.Rarity != first.Rarity))
            throw new InventoryException.IngredientsRarityMismatchException();
        if (first.Rarity == ItemRarity.Legendary)
            throw new InventoryException.CannotCraftFromLegendaryException();

        foreach (var ingredient in ingredients) ingredient.Consume();

        var craftedRarity = first.Rarity + 1;
        return Create(first.OwnerUserId, $"Crafted {craftedRarity} Item", craftedRarity);
    }

    public void LockForAuction(Guid publicAuctionId)
    {
        EnsureAvailable();
        Status = ItemStatus.LockedForAuction;
        LockedForAuctionId = publicAuctionId;
        Version = Guid.NewGuid();
    }

    public void UnlockItem()
    {
        if (Status != ItemStatus.LockedForAuction) throw new InventoryException.ItemNotLockedException();
        Status = ItemStatus.Available;
        LockedForAuctionId = null;
        Version = Guid.NewGuid();
    }

    public void TransferTo(Guid newOwnerId)
    {
        if (Status != ItemStatus.LockedForAuction) throw new InventoryException.ItemNotLockedException();
        OwnerUserId = newOwnerId;
        Status = ItemStatus.Available;
        LockedForAuctionId = null;
        Version = Guid.NewGuid();
    }

    public void SellToOfficialShop()
    {
        EnsureAvailable();
        Status = ItemStatus.SoldToShop;
        Version = Guid.NewGuid();
    }

    private void Consume()
    {
        EnsureAvailable();
        Status = ItemStatus.Consumed;
        Version = Guid.NewGuid();
    }

    private void EnsureAvailable()
    {
        if (Status != ItemStatus.Available) throw new InventoryException.ItemNotAvailableException(Status);
    }

    private static decimal RollPriceFor(ItemRarity rarity) => rarity switch
    {
        ItemRarity.Common    => Random.Shared.Next(10, 100),
        ItemRarity.Rare      => Random.Shared.Next(100, 1_000),
        ItemRarity.Epic      => Random.Shared.Next(1_000, 10_000),
        ItemRarity.Legendary => Random.Shared.Next(10_000, 100_000),
        _ => throw new ArgumentOutOfRangeException(nameof(rarity))
    };
}

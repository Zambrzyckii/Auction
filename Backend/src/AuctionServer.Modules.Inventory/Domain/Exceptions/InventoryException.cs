using AuctionServer.Modules.Inventory.Domain.Enums;
using AuctionServer.Shared.Integration.Exceptions;

namespace AuctionServer.Modules.Inventory.Domain.Exceptions;

public class InventoryException
{
    public class ItemNotAvailableException(ItemStatus status) : AppException($"Item is not available, current status: {status}", 400);
    public class ItemNotLockedException() : AppException("This item is not locked", 400);
    public class NotEnoughIngredientsToCraftException() : AppException("Crafting requires exactly 3 ingredients", 400);
    public class IngredientsOwnerMismatchException() : AppException("All ingredients must belong to the same owner", 400);
    public class IngredientsRarityMismatchException() : AppException("All ingredients must share the same rarity", 400);
    public class CannotCraftFromLegendaryException() : AppException("Legendary items cannot be used as crafting ingredients", 400);
}

namespace AuctionServer.Modules.Inventory.Application;

public sealed record InventoryOptions(IReadOnlyList<StarterItemDefinition> StarterItems);

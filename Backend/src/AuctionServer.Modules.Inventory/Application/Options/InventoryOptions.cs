namespace AuctionServer.Modules.Inventory.Application.Options;

public sealed record InventoryOptions(IReadOnlyList<StarterItemDefinition> StarterItems);

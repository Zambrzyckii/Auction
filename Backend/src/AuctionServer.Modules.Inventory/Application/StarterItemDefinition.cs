using AuctionServer.Modules.Inventory.Domain.Enums;

namespace AuctionServer.Modules.Inventory.Application;

public sealed record StarterItemDefinition(string Name, ItemRarity Rarity);

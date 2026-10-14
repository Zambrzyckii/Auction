using AuctionServer.Modules.Inventory.Domain.Enums;

namespace AuctionServer.Modules.Inventory.Application.Options;

public sealed record StarterItemDefinition(string Name, ItemRarity Rarity);

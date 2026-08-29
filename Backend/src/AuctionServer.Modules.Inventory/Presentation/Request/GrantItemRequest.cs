using AuctionServer.Modules.Inventory.Domain.Enums;

namespace AuctionServer.Modules.Inventory.Presentation.Request;

public record GrantItemRequest(string Name, ItemRarity Rarity);

using AuctionServer.Modules.Inventory.Domain.Enums;

namespace AuctionServer.Modules.Inventory.Application.Queries.GetUserItemsQuery;

public record UserItemsDto(Guid PublicItemId, string Name, ItemRarity Rarity, ItemStatus Status, decimal OfficialPrice);
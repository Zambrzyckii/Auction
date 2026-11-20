using AuctionServer.Modules.Inventory.Domain.Enums;

namespace AuctionServer.Api.Infrastructure.TestAccount;

public sealed record TestAccountItem(string Name, ItemRarity Rarity);

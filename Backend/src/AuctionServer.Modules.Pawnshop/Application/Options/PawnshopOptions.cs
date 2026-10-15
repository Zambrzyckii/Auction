using AuctionServer.Modules.Pawnshop.Domain.Enums;

namespace AuctionServer.Modules.Pawnshop.Application.Options;

public sealed record PawnshopOptions(
    decimal PremisesPrice,
    decimal PremisesRequiredTurnover,
    TimeSpan StockSellDelay,
    TimeSpan StockRequestTimeout,
    TimeSpan PaymentTimeout,
    IReadOnlyList<BotTierDefinition> BotTiers);

public sealed record BotTierDefinition(string Name, PawnshopRarity Rarity, decimal Price, TimeSpan SpawnInterval, decimal PayoutRate);

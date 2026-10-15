using AuctionServer.Modules.Pawnshop.Domain.Enums;
using MediatR;

namespace AuctionServer.Modules.Pawnshop.Application.Queries.GetOffers;

public record GetOffersQuery : IRequest<PawnshopOffersDto>;

public record PawnshopOffersDto(
    decimal PremisesPrice,
    decimal PremisesRequiredTurnover,
    TimeSpan StockSellDelay,
    IReadOnlyList<BotTierDto> BotTiers);

public record BotTierDto(string Name, PawnshopRarity Rarity, decimal Price, TimeSpan SpawnInterval, decimal PayoutRate);

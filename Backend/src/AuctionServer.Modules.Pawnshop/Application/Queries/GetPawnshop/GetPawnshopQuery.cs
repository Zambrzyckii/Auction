using AuctionServer.Modules.Pawnshop.Domain.Enums;
using MediatR;

namespace AuctionServer.Modules.Pawnshop.Application.Queries.GetPawnshop;

public record GetPawnshopQuery(Guid UserId) : IRequest<PawnshopDto>;

public record PawnshopDto(
    Guid PublicPawnshopId,
    ShopStatus Status,
    DateTime RequestedOn,
    DateTime? ActivatedOn,
    string? RejectionReason,
    string? BotTierName,
    PawnshopRarity? BotRarity,
    TimeSpan? BotSpawnInterval,
    decimal? BotPayoutRate,
    DateTime? BotPurchasedOn,
    DateTime? NextSpawnOn,
    string? PendingBotTierName,
    IReadOnlyList<StockItemDto> Stock);

public record StockItemDto(
    Guid PublicStockItemId,
    string Name,
    PawnshopRarity Rarity,
    decimal Price,
    decimal PayoutRate,
    StockItemStatus Status,
    DateTime SpawnedOn,
    DateTime SellAfter,
    DateTime? ResolvedOn,
    decimal? PayoutAmount);

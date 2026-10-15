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
    string? PendingBotTierName);

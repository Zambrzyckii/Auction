using AuctionServer.Modules.Auctions.Domain.Enums;

namespace AuctionServer.Modules.Auctions.Application.Queries.GetActiveAuctions;

public record ActiveAuctionQueryDto(
    Guid PublicAuctionId,
    Guid SellerUserId,
    Guid? CurrentWinningUserId,
    AuctionStatus Status,
    decimal CurrentPrice,
    DateTime EndsOn,
    string? ItemName,
    string? ItemRarity,
    decimal? ItemOfficialPrice,
    string? CancellationReason);
using AuctionServer.Modules.Auctions.Domain.Enums;

namespace AuctionServer.Modules.Auctions.Application.Queries.GetAuctionById;

public record AuctionByIdQueryDto(
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
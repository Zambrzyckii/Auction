using AuctionServer.Modules.Warehouses.Domain.Enums;

namespace AuctionServer.Modules.Warehouses.Application.Queries.GetWarehouses;

public record WarehouseSummaryDto(
    Guid PublicWarehouseId,
    string Tier,
    WarehouseWarStatus Status,
    decimal EstimateMin,
    decimal EstimateMax,
    decimal EntryFee,
    decimal CurrentPrice,
    int ItemCount,
    int Players,
    int MaxPlayers,
    DateTime? BiddingStartsOn,
    DateTime? BiddingEndsOn);

using AuctionServer.Modules.Warehouses.Domain.Enums;

namespace AuctionServer.Modules.Warehouses.Application.Queries.GetMyWarehouses;

public record MyWarehouseDto(
    Guid PublicWarehouseId,
    string Tier,
    WarehouseWarStatus Status,
    decimal EntryFee,
    decimal CurrentPrice,
    int ItemCount,
    int Players,
    DateTime? BiddingEndsOn,
    bool IsLeader,
    ParticipantState ParticipantState,
    string? CancellationReason);

using AuctionServer.Modules.Warehouses.Domain.Enums;

namespace AuctionServer.Modules.Warehouses.Application.Queries.GetWarehouseById;

public record WarehouseDetailsDto(
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
    DateTime? BiddingEndsOn,
    bool IsParticipant,
    ParticipantState? ParticipantState,
    bool IsLeader,
    string? CancellationReason,
    IReadOnlyList<ManifestItemDto>? Manifest);

public record ManifestItemDto(string Name, string Rarity, decimal Price);

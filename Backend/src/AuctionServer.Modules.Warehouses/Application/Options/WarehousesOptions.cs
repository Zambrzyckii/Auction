namespace AuctionServer.Modules.Warehouses.Application.Options;

public sealed record WarehousesOptions(
    int PoolSize,
    int MinPlayers,
    int MaxPlayers,
    TimeSpan JoinCountdown,
    TimeSpan RaiseWindow,
    TimeSpan LobbyTimeout,
    IReadOnlyList<WarehouseTierDefinition> Tiers,
    IReadOnlyList<EstimateVariant> EstimateVariants);

namespace AuctionServer.Modules.Warehouses.Application.Options;

public sealed record WarehouseTierDefinition(
    string Name,
    int ItemCountMin,
    int ItemCountMax,
    decimal EntryFee,
    IReadOnlyList<decimal> Increments,
    IReadOnlyList<RarityWeight> RarityWeights);

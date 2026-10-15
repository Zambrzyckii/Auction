using AuctionServer.Modules.Pawnshop.Domain.Enums;

namespace AuctionServer.Modules.Pawnshop.Domain.Entities;

public sealed class StockItem
{
    public int Id { get; init; }
    public Guid PublicStockItemId { get; init; } = Guid.NewGuid();
    public Guid PublicPawnshopId { get; init; }
    public Guid UserId { get; init; }
    public required string Name { get; init; }
    public PawnshopRarity Rarity { get; init; }
    public decimal Price { get; init; }
    public decimal PayoutRate { get; init; }
    public StockItemStatus Status { get; private set; } = StockItemStatus.InStock;
    public DateTime SpawnedOn { get; init; }
    public DateTime SellAfter { get; init; }
    public DateTime? ResolvedOn { get; private set; }
    public decimal? PayoutAmount { get; private set; }
    public Guid Version { get; private set; } = Guid.NewGuid();
}

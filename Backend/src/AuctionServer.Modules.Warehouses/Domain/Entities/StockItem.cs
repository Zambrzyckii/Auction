namespace AuctionServer.Modules.Warehouses.Domain.Entities;

public class StockItem
{
    public int Id { get; init; }
    public Guid PublicWarehouseId { get; init; }
    public required string Name { get; init; }
    public required string Rarity { get; init; }
    public decimal Price { get; init; }
}

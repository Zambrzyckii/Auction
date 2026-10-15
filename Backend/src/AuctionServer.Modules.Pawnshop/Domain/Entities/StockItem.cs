using AuctionServer.Modules.Pawnshop.Domain.Enums;
using AuctionServer.Modules.Pawnshop.Domain.Exceptions;

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

    public void Withdraw(DateTime now)
    {
        if (Status != StockItemStatus.InStock) throw new PawnshopExceptions.StockItemNotInStockException();
        if (now >= SellAfter) throw new PawnshopExceptions.StockWindowClosedException();

        Status = StockItemStatus.Withdrawn;
        ResolvedOn = now;
        Version = Guid.NewGuid();
    }

    public decimal Sell(DateTime now)
    {
        if (Status != StockItemStatus.InStock) throw new PawnshopExceptions.StockItemNotInStockException();
        if (now < SellAfter) throw new PawnshopExceptions.StockItemNotDueException();
        
        PayoutAmount = Math.Round(Price * PayoutRate, 2, MidpointRounding.AwayFromZero);
        Status = StockItemStatus.Sold;
        ResolvedOn = now;
        Version = Guid.NewGuid();
        return PayoutAmount.Value;
    }

    public static IReadOnlyList<PayoutBatch> SellDue(IEnumerable<StockItem> dueItems, DateTime now)
    {
        return dueItems
            .Select(i => (i.PublicPawnshopId, i.UserId, Amount: i.Sell(now)))
            .GroupBy(x => (x.PublicPawnshopId, x.UserId))
            .Select(g => new PayoutBatch(g.Key.PublicPawnshopId, g.Key.UserId, g.Sum(x => x.Amount)))
            .ToList();
    }
}

public record PayoutBatch(Guid PublicPawnshopId, Guid UserId, decimal Amount);

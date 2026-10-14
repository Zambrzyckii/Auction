using AuctionServer.Modules.Warehouses.Domain.Enums;
using AuctionServer.Modules.Warehouses.Domain.Exceptions;

namespace AuctionServer.Modules.Warehouses.Domain.Entities;

public sealed class WarehouseWar
{
    public int Id { get; init; }
    public Guid PublicWarehouseId { get; init; } = Guid.NewGuid();
    public required string Tier { get; init; }
    public WarehouseWarStatus Status { get; private set; } = WarehouseWarStatus.Stocking;
    public decimal TotalValue { get; private set; }
    public decimal EstimateMin { get; private set; }
    public decimal EstimateMax { get; private set; }
    public decimal EntryFee { get; init; }
    public decimal CurrentPrice { get; private set; }
    public Guid? CurrentLeaderId { get; private set; }
    public DateTime? BiddingStartsOn { get; private set; }
    public DateTime? BiddingEndsOn { get; private set; }
    public DateTime CreatedOn { get; init; } = DateTime.UtcNow;
    public Guid Version { get; private set; } = Guid.NewGuid();

    public static WarehouseWar Create(string tier, decimal entryFee)
    {
        if (entryFee <= 0) throw new WarehouseExceptions.InvalidEntryFeeException();

        return new WarehouseWar { Tier = tier, EntryFee = entryFee };
    }

    public void OpenLobby(decimal totalValue, decimal estimateMin, decimal estimateMax)
    {
        if (Status != WarehouseWarStatus.Stocking) throw new WarehouseExceptions.WarNotStockingException(Status);
        if (totalValue <= 0 || estimateMin <= 0 || estimateMax < estimateMin)
            throw new WarehouseExceptions.InvalidEstimateException();

        TotalValue = totalValue;
        EstimateMin = estimateMin;
        EstimateMax = estimateMax;
        Status = WarehouseWarStatus.Open;
        Version = Guid.NewGuid();
    }
}

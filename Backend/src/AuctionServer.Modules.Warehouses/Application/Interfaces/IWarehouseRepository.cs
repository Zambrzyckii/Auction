using AuctionServer.Modules.Warehouses.Domain.Entities;
using AuctionServer.Shared.Infrastructure.Outbox;

namespace AuctionServer.Modules.Warehouses.Application.Interfaces;

public interface IWarehouseRepository
{
    Task<WarehouseWar> GetWarByPublicIdAsync(Guid publicWarehouseId, CancellationToken token);
    void AddStock(List<StockItem> stockItems);
    Task ApplyOnceAsync(Guid eventId, Func<Task> change, CancellationToken token);
    Task ApplyOnceAsync(Guid eventId, Func<Task<OutboxMessage?>> change, CancellationToken token);
    Task SaveWarWithOutboxAsync(OutboxMessage outboxMessage, CancellationToken token);
    Task SaveWarAsync(CancellationToken token);
    Task<List<WarehouseWar>> GetActiveWarsReadOnlyAsync(int limit, CancellationToken token);
    Task<WarehouseWar> GetWarByPublicIdReadOnlyAsync(Guid publicWarehouseId, CancellationToken token);
    Task<Dictionary<Guid, int>> GetStockCountsReadOnlyAsync(List<Guid> publicWarehouseIds, CancellationToken token);
    Task<List<StockItem>> GetStockReadOnlyAsync(Guid publicWarehouseId, CancellationToken token);
}

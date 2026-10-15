using AuctionServer.Modules.Warehouses.Domain.Entities;
using AuctionServer.Modules.Warehouses.Infrastructure.Inbox;
using AuctionServer.Modules.Warehouses.Infrastructure.Outbox;

namespace AuctionServer.Modules.Warehouses.Application.Interfaces;

public interface IWarehouseRepository
{
    Task<WarehouseWar> GetWarByPublicIdAsync(Guid publicWarehouseId, CancellationToken token);
    Task<bool> WasEventProcessedAsync(Guid eventId, CancellationToken token);
    Task SaveStockWithInboxAsync(List<StockItem> stockItems, ProcessedMessage inboxMessage, CancellationToken token);
    Task SaveWarWithInboxAsync(ProcessedMessage inboxMessage, CancellationToken token);
    Task SaveWarWithInboxAndOutboxAsync(ProcessedMessage inboxMessage, OutboxMessage outboxMessage, CancellationToken token);
    Task SaveWarWithOutboxAsync(OutboxMessage outboxMessage, CancellationToken token);
    Task SaveWarAsync(CancellationToken token);
    Task<List<WarehouseWar>> GetActiveWarsReadOnlyAsync(int limit, CancellationToken token);
    Task<WarehouseWar> GetWarByPublicIdReadOnlyAsync(Guid publicWarehouseId, CancellationToken token);
    Task<Dictionary<Guid, int>> GetStockCountsReadOnlyAsync(List<Guid> publicWarehouseIds, CancellationToken token);
    Task<List<StockItem>> GetStockReadOnlyAsync(Guid publicWarehouseId, CancellationToken token);
}

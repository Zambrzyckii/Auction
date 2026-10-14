using AuctionServer.Modules.Warehouses.Domain.Entities;
using AuctionServer.Modules.Warehouses.Infrastructure.Inbox;

namespace AuctionServer.Modules.Warehouses.Application.Interfaces;

public interface IWarehouseRepository
{
    Task<WarehouseWar> GetWarByPublicIdAsync(Guid publicWarehouseId, CancellationToken token);
    Task<bool> WasEventProcessedAsync(Guid eventId, CancellationToken token);
    Task SaveStockWithInboxAsync(List<StockItem> stockItems, ProcessedMessage inboxMessage, CancellationToken token);
}

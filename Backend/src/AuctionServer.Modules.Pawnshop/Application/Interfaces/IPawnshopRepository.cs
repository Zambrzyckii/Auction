using AuctionServer.Modules.Pawnshop.Domain.Entities;
using AuctionServer.Shared.Infrastructure.Outbox;

namespace AuctionServer.Modules.Pawnshop.Application.Interfaces;

public interface IPawnshopRepository
{
    Task<Shop> GetShopByPublicIdAsync(Guid publicPawnshopId, CancellationToken token);
    Task<Shop> GetLiveShopByUserIdAsync(Guid userId, CancellationToken token);
    Task<Shop?> GetLatestShopByUserIdReadOnlyAsync(Guid userId, CancellationToken token);
    Task ApplyOnceAsync(Guid eventId, Func<Task> change, CancellationToken token);
    Task ApplyOnceAsync(Guid eventId, Func<Task<OutboxMessage?>> change, CancellationToken token);
    Task SaveNewShopWithOutboxAsync(Shop shop, OutboxMessage outboxMessage, CancellationToken token);
    Task SaveChangesWithOutboxAsync(OutboxMessage outboxMessage, CancellationToken token);
    void AddStock(IReadOnlyList<StockItem> items);
    Task<List<StockItem>> GetStockReadOnlyAsync(Guid publicPawnshopId, CancellationToken token);
    Task<StockItem> GetStockItemByPublicIdAsync(Guid publicStockItemId, CancellationToken token);
}

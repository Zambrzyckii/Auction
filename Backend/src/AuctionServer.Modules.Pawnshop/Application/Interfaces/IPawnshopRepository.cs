using AuctionServer.Modules.Pawnshop.Domain.Entities;
using AuctionServer.Modules.Pawnshop.Infrastructure.Inbox;
using AuctionServer.Modules.Pawnshop.Infrastructure.Outbox;

namespace AuctionServer.Modules.Pawnshop.Application.Interfaces;

public interface IPawnshopRepository
{
    Task<Shop> GetShopByPublicIdAsync(Guid publicPawnshopId, CancellationToken token);
    Task<Shop> GetLiveShopByUserIdAsync(Guid userId, CancellationToken token);
    Task<Shop?> GetLatestShopByUserIdReadOnlyAsync(Guid userId, CancellationToken token);
    Task<bool> WasEventProcessedAsync(Guid eventId, CancellationToken token);
    Task SaveNewShopWithOutboxAsync(Shop shop, OutboxMessage outboxMessage, CancellationToken token);
    Task SaveShopWithOutboxAsync(OutboxMessage outboxMessage, CancellationToken token);
    Task SaveShopWithInboxAsync(ProcessedMessage inboxMessage, CancellationToken token);
    Task SaveStockWithInboxAsync(IReadOnlyList<StockItem> items, ProcessedMessage inboxMessage, CancellationToken token);
    Task<List<StockItem>> GetStockReadOnlyAsync(Guid publicPawnshopId, CancellationToken token);
}

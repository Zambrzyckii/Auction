using AuctionServer.Modules.Inventory.Domain.Entities;
using AuctionServer.Modules.Inventory.Infrastructure.Outbox;

namespace AuctionServer.Modules.Inventory.Application.Interfaces;

public interface IItemRepository
{
    Task<Item> GetUserItemAsync(Guid ownerUserId, Guid publicItemId, CancellationToken token);
    Task<List<Item>> GetUserSelectedItemsAsync(Guid ownerUserId, IReadOnlyList<Guid> publicItemIds, CancellationToken token);
    Task<List<Item>> GetUserItemsReadOnlyAsync(Guid ownerUserId, CancellationToken token);
    Task AddItemAsync(Item item, CancellationToken token);
    Task AddItemsAsync(List<Item> items, CancellationToken token);
    Task SaveAsync(CancellationToken token);
    Task SaveChangesWithOutboxAsync(OutboxMessage message, CancellationToken token);
}
using AuctionServer.Modules.Inventory.Domain.Entities;
using AuctionServer.Shared.Infrastructure.Outbox;

namespace AuctionServer.Modules.Inventory.Application.Interfaces;

public interface IItemRepository
{
    Task<Item> GetUserItemAsync(Guid ownerUserId, Guid publicItemId, CancellationToken token);
    Task<List<Item>> GetUserSelectedItemsAsync(Guid ownerUserId, IReadOnlyList<Guid> publicItemIds, CancellationToken token);
    Task<List<Item>> GetUserItemsReadOnlyAsync(Guid ownerUserId, CancellationToken token);
    Task AddItemAsync(Item item, CancellationToken token);
    Task AddItemsAsync(List<Item> items, CancellationToken token);
    void AddItems(List<Item> items);
    Task SaveAsync(CancellationToken token);
    Task SaveChangesWithOutboxAsync(OutboxMessage message, CancellationToken token);
    Task ApplyOnceAsync(Guid eventId, Func<Task> change, CancellationToken token);
    Task ApplyOnceAsync(Guid eventId, Func<Task<OutboxMessage?>> change, CancellationToken token);

    Task<Item> GetItemLockedForAuctionAsync(Guid publicAuctionId, CancellationToken token);

    Task<Item?> FindItemLockedForAuctionAsync(Guid publicAuctionId, CancellationToken token);
}
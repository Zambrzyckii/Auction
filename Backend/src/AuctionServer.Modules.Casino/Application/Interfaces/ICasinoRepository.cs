using AuctionServer.Modules.Casino.Domain.Entities;
using AuctionServer.Modules.Casino.Infrastructure.Inbox;
using AuctionServer.Modules.Casino.Infrastructure.Outbox;

namespace AuctionServer.Modules.Casino.Application.Interfaces;

public interface ICasinoRepository
{
    Task<ChipAccount?> FindAccountByUserIdAsync(Guid userId, CancellationToken token);
    Task<ChipAccount> GetAccountByUserIdAsync(Guid userId, CancellationToken token);
    Task<ChipAccount?> GetAccountReadOnlyAsync(Guid userId, CancellationToken token);
    Task<ChipPurchase> GetPurchaseByPublicIdAsync(Guid publicPurchaseId, CancellationToken token);
    Task<ChipPurchase?> GetLatestPurchaseReadOnlyAsync(Guid userId, CancellationToken token);
    Task<bool> WasEventProcessedAsync(Guid eventId, CancellationToken token);
    void AddAccount(ChipAccount account);
    Task SaveNewPurchaseWithOutboxAsync(ChipPurchase purchase, OutboxMessage outboxMessage, CancellationToken token);
    Task SaveChangesWithOutboxAsync(OutboxMessage outboxMessage, CancellationToken token);
    Task SaveChangesWithInboxAsync(ProcessedMessage inboxMessage, CancellationToken token);
}

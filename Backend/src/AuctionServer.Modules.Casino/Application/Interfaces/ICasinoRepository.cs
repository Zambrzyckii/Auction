using AuctionServer.Modules.Casino.Domain.Entities;
using AuctionServer.Shared.Infrastructure.Outbox;

namespace AuctionServer.Modules.Casino.Application.Interfaces;

public interface ICasinoRepository
{
    Task<ChipAccount?> FindAccountByUserIdAsync(Guid userId, CancellationToken token);
    Task<ChipAccount> GetAccountByUserIdAsync(Guid userId, CancellationToken token);
    Task<ChipAccount?> GetAccountReadOnlyAsync(Guid userId, CancellationToken token);
    Task<ChipPurchase> GetPurchaseByPublicIdAsync(Guid publicPurchaseId, CancellationToken token);
    Task<ChipPurchase?> GetLatestPurchaseReadOnlyAsync(Guid userId, CancellationToken token);
    Task ApplyOnceAsync(Guid eventId, Func<Task> change, CancellationToken token);
    Task<List<RouletteSpin>> GetRecentSpinsReadOnlyAsync(Guid userId, int take, CancellationToken token);
    Task<BlackjackHand> GetHandByPublicIdAsync(Guid publicHandId, CancellationToken token);
    Task<BlackjackHand?> GetActiveHandReadOnlyAsync(Guid userId, CancellationToken token);
    Task<List<BlackjackHand>> GetRecentCompletedHandsReadOnlyAsync(Guid userId, int take, CancellationToken token);
    void AddAccount(ChipAccount account);
    Task SaveNewSpinAsync(RouletteSpin spin, CancellationToken token);
    Task SaveNewHandAsync(BlackjackHand hand, CancellationToken token);
    Task SaveChangesAsync(CancellationToken token);
    Task SaveNewPurchaseWithOutboxAsync(ChipPurchase purchase, OutboxMessage outboxMessage, CancellationToken token);
    Task SaveChangesWithOutboxAsync(OutboxMessage outboxMessage, CancellationToken token);
}

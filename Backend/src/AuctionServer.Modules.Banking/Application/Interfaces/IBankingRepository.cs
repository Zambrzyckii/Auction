using AuctionServer.Modules.Banking.Domain.Entities;
using AuctionServer.Modules.Banking.Infrastructure.Inbox;
using AuctionServer.Modules.Banking.Infrastructure.Outbox;

namespace AuctionServer.Modules.Banking.Application.Interfaces;

public interface IBankingRepository
{
    Task<Loan> GetLoanByPublicIdAsync(Guid publicLoanId, CancellationToken token);
    Task<bool> WasEventProcessedAsync(Guid eventId, CancellationToken token);
    Task SaveNewLoanWithOutboxAsync(Loan loan, OutboxMessage outboxMessage, CancellationToken token);
    Task SaveLoanWithInboxAsync(ProcessedMessage inboxMessage, CancellationToken token);
    Task SaveLoanWithOutboxAsync(OutboxMessage outboxMessage, CancellationToken token);
    Task<List<Loan>> GetUserLoansReadOnlyAsync(Guid userId, CancellationToken token);
}

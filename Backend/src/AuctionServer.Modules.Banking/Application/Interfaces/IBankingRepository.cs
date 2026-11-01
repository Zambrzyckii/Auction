using AuctionServer.Modules.Banking.Domain.Entities;
using AuctionServer.Shared.Infrastructure.Outbox;

namespace AuctionServer.Modules.Banking.Application.Interfaces;

public interface IBankingRepository
{
    Task<Loan> GetLoanByPublicIdAsync(Guid publicLoanId, CancellationToken token);
    Task ApplyOnceAsync(Guid eventId, Func<Task> change, CancellationToken token);
    Task SaveNewLoanWithOutboxAsync(Loan loan, OutboxMessage outboxMessage, CancellationToken token);
    Task SaveLoanWithOutboxAsync(OutboxMessage outboxMessage, CancellationToken token);
    Task<List<Loan>> GetUserLoansReadOnlyAsync(Guid userId, CancellationToken token);
}

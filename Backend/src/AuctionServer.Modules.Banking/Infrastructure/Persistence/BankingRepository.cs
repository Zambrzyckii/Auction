using AuctionServer.Modules.Banking.Application.Interfaces;
using AuctionServer.Modules.Banking.Domain.Entities;
using AuctionServer.Modules.Banking.Domain.Exceptions;
using AuctionServer.Modules.Banking.Infrastructure.Inbox;
using AuctionServer.Modules.Banking.Infrastructure.Outbox;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace AuctionServer.Modules.Banking.Infrastructure.Persistence;

public sealed class BankingRepository(BankingDbContext context) : IBankingRepository
{
    public async Task<Loan> GetLoanByPublicIdAsync(Guid publicLoanId, CancellationToken token)
    {
        var loan = await context.Loans.SingleOrDefaultAsync(l => l.PublicLoanId == publicLoanId, token);
        if (loan is null) throw new BankingExceptions.LoanNotFoundException(publicLoanId);
        return loan;
    }

    public async Task<bool> WasEventProcessedAsync(Guid eventId, CancellationToken token)
    {
        return await context.ProcessedMessages.Where(m => m.EventId == eventId).AnyAsync(token);
    }

    public async Task SaveNewLoanWithOutboxAsync(Loan loan, OutboxMessage outboxMessage, CancellationToken token)
    {
        context.Loans.Add(loan);
        context.OutboxMessages.Add(outboxMessage);
        try
        {
            await context.SaveChangesAsync(token);
        }
        catch (DbUpdateException e) when (e.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
        {
            throw new BankingExceptions.LoanAlreadyActiveException();
        }
    }

    public async Task SaveLoanWithInboxAsync(ProcessedMessage inboxMessage, CancellationToken token)
    {
        context.ProcessedMessages.Add(inboxMessage);
        try
        {
            await context.SaveChangesAsync(token);
        }
        catch (DbUpdateException e) when (e.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
        {
            throw new BankingExceptions.EventAlreadyProcessedException();
        }
    }

    public async Task SaveLoanWithOutboxAsync(OutboxMessage outboxMessage, CancellationToken token)
    {
        context.OutboxMessages.Add(outboxMessage);
        await context.SaveChangesAsync(token);
    }

    public async Task<List<Loan>> GetUserLoansReadOnlyAsync(Guid userId, CancellationToken token)
    {
        return await context.Loans.AsNoTracking()
            .Where(l => l.UserId == userId)
            .OrderByDescending(l => l.RequestedOn)
            .Take(50)
            .ToListAsync(token);
    }
}

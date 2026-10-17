using AuctionServer.Modules.Casino.Application.Interfaces;
using AuctionServer.Modules.Casino.Domain.Entities;
using AuctionServer.Modules.Casino.Domain.Exceptions;
using AuctionServer.Modules.Casino.Infrastructure.Inbox;
using AuctionServer.Modules.Casino.Infrastructure.Outbox;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace AuctionServer.Modules.Casino.Infrastructure.Persistence;

public sealed class CasinoRepository(CasinoDbContext context) : ICasinoRepository
{
    public async Task<ChipAccount?> FindAccountByUserIdAsync(Guid userId, CancellationToken token) =>
        await context.ChipAccounts.SingleOrDefaultAsync(a => a.UserId == userId, token);

    public async Task<ChipAccount> GetAccountByUserIdAsync(Guid userId, CancellationToken token)
    {
        var account = await context.ChipAccounts.SingleOrDefaultAsync(a => a.UserId == userId, token);

        if (account is null) throw new CasinoExceptions.ChipAccountNotFoundException();

        return account;
    }

    public async Task<ChipAccount?> GetAccountReadOnlyAsync(Guid userId, CancellationToken token) =>
        await context.ChipAccounts.AsNoTracking().SingleOrDefaultAsync(a => a.UserId == userId, token);

    public async Task<ChipPurchase> GetPurchaseByPublicIdAsync(Guid publicPurchaseId, CancellationToken token)
    {
        var purchase = await context.ChipPurchases
            .SingleOrDefaultAsync(p => p.PublicPurchaseId == publicPurchaseId, token);

        if (purchase is null) throw new CasinoExceptions.ChipPurchaseNotFoundException();

        return purchase;
    }

    public async Task<ChipPurchase?> GetLatestPurchaseReadOnlyAsync(Guid userId, CancellationToken token) =>
        await context.ChipPurchases.AsNoTracking()
            .Where(p => p.UserId == userId)
            .OrderByDescending(p => p.RequestedOn)
            .FirstOrDefaultAsync(token);

    public async Task<bool> WasEventProcessedAsync(Guid eventId, CancellationToken token) =>
        await context.ProcessedMessages.Where(m => m.EventId == eventId).AnyAsync(token);

    public void AddAccount(ChipAccount account) => context.ChipAccounts.Add(account);

    public async Task SaveNewPurchaseWithOutboxAsync(ChipPurchase purchase, OutboxMessage outboxMessage, CancellationToken token)
    {
        context.ChipPurchases.Add(purchase);
        context.OutboxMessages.Add(outboxMessage);

        try
        {
            await context.SaveChangesAsync(token);
        }
        catch (DbUpdateException e) when (e.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
        {
            throw new CasinoExceptions.PurchaseInProgressException();
        }
    }

    public async Task SaveChangesWithOutboxAsync(OutboxMessage outboxMessage, CancellationToken token)
    {
        context.OutboxMessages.Add(outboxMessage);
        await context.SaveChangesAsync(token);
    }

    public async Task SaveChangesWithInboxAsync(ProcessedMessage inboxMessage, CancellationToken token)
    {
        context.ProcessedMessages.Add(inboxMessage);

        try
        {
            await context.SaveChangesAsync(token);
        }
        catch (DbUpdateException e) when (e.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
        {
            throw new CasinoExceptions.EventAlreadyProcessedException();
        }
    }
}

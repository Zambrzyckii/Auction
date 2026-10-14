using AuctionServer.Modules.Wallets.Application.Interfaces.Persistence;
using AuctionServer.Modules.Wallets.Domain.Entities;
using AuctionServer.Modules.Wallets.Domain.Exceptions;
using AuctionServer.Modules.Wallets.Infrastructure.Inbox;
using AuctionServer.Modules.Wallets.Infrastructure.Outbox;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace AuctionServer.Modules.Wallets.Infrastructure.Persistence;

public class WalletRepository(WalletDbContext context) : IWalletRepository
{
    public async Task SaveUserFundsAsync(CancellationToken token)
    {
        await context.SaveChangesAsync(token);
    }

    public async Task<Wallet> GetUserWalletByIdAsync(Guid userPublicId, CancellationToken token)
    {
        var userWallet = await context.Wallets.SingleOrDefaultAsync(u => userPublicId == u.UserId, token);
        if (userWallet is null) throw new WalletExceptions.UserWithThisIdDontHaveWallet(userPublicId);
        return userWallet;
    }

    public async Task<Wallet> GetUserWalletByIdAsyncReadOnly(Guid userPublicId, CancellationToken token)
    {
        var userWallet = await context.Wallets.AsNoTracking().SingleOrDefaultAsync(u => userPublicId == u.UserId, token);
        if (userWallet is null) throw new WalletExceptions.UserWithThisIdDontHaveWallet(userPublicId);
        return userWallet;
    }

    public async Task AddWalletAsync(Wallet wallet, CancellationToken token)
    {
        await context.Wallets.AddAsync(wallet, token);
        try
        {
            await context.SaveChangesAsync(token);
        }
        catch (DbUpdateException e) when (e.InnerException is PostgresException
                                          {
                                              SqlState: PostgresErrorCodes.UniqueViolation
                                          })
        {
            throw new WalletExceptions.WalletAlreadyExistException();
        }
    }

    public async Task SaveTransferAsync(Transfer transfer, CancellationToken token)
    {
        context.Transfers.Add(transfer);
        await context.SaveChangesAsync(token);
    }

    public async Task<List<Transfer>> GetUserTransfersReadOnlyAsync(Guid userPublicId, CancellationToken token)
    {
        return await context.Transfers.AsNoTracking()
            .Where(t => t.SenderUserId == userPublicId || t.RecipientUserId == userPublicId)
            .OrderByDescending(t => t.SentOn).ThenByDescending(t => t.Id)
            .ToListAsync(token);
    }

    public async Task SaveUserFundsWithInboxAsync(ProcessedMessage message, CancellationToken token)
    {
        context.ProcessedMessages.Add(message);
        try
        {
            await context.SaveChangesAsync(token);
        }
        catch (DbUpdateException e) when (e.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
        {
            throw new WalletExceptions.EventAlreadyProcessedException();
        }
    }

    public async Task<bool> WasEventProcessedAsync(Guid eventId, CancellationToken token)
    {
        return await context.ProcessedMessages.Where(m => m.EventId == eventId).AnyAsync(token);
    }

    public async Task SaveUserFundsWithInboxAndOutboxAsync(ProcessedMessage message, OutboxMessage outboxMessage,
        CancellationToken token)
    {
        context.ProcessedMessages.Add(message);
        context.OutboxMessages.Add(outboxMessage);
        try
        {
            await context.SaveChangesAsync(token);
        }
        catch (DbUpdateException e) when (e.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
        {
            throw new WalletExceptions.EventAlreadyProcessedException();
        }
    }
}
using AuctionServer.Modules.Wallets.Application.Interfaces.Persistence;
using AuctionServer.Modules.Wallets.Domain.Entities;
using AuctionServer.Modules.Wallets.Domain.Exceptions;
using AuctionServer.Modules.Wallets.Infrastructure.Inbox;
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
}
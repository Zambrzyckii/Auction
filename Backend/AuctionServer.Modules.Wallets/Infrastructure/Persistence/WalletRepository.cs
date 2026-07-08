using AuctionServer.Modules.Wallets.Application.Interfaces.Persistence;
using AuctionServer.Modules.Wallets.Domain.Entities;
using AuctionServer.Modules.Wallets.Domain.Exceptions;
using Microsoft.EntityFrameworkCore;

namespace AuctionServer.Modules.Wallets.Infrastructure.Persistence;

public class WalletRepository(AppDbContext context) : IWalletRepository
{
    public async Task SaveUserFundsAsync(CancellationToken token)
    {
        await context.SaveChangesAsync(token);
    }

    public async Task<Wallet?> GetUserWalletByIdAsync(Guid userPublicId, CancellationToken token)
    {
        var userWallet = await context.Wallets.SingleOrDefaultAsync(u => userPublicId == u.UserId, token);
        if (userWallet is null) throw new WalletExceptions.UserWithThisIdDontHaveWallet(userPublicId);
        return userWallet;
    }

    public async Task<Wallet?> GetUserWalletByIdAsyncReadOnly(Guid userPublicId, CancellationToken token)
    {
        var userWallet = await context.Wallets.AsNoTracking().SingleOrDefaultAsync(u => userPublicId == u.UserId, token);
        if (userWallet is null) throw new WalletExceptions.UserWithThisIdDontHaveWallet(userPublicId);
        return userWallet;
    }
}
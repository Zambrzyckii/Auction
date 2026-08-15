using AuctionServer.Modules.Wallets.Domain.Entities;
using AuctionServer.Modules.Wallets.Infrastructure.Inbox;

namespace AuctionServer.Modules.Wallets.Application.Interfaces.Persistence;

public interface IWalletRepository
{
    public Task SaveUserFundsAsync(CancellationToken token);
    public Task<Wallet> GetUserWalletByIdAsync(Guid userPublicId, CancellationToken token);

    public Task<Wallet> GetUserWalletByIdAsyncReadOnly(Guid userPublicId, CancellationToken token);

    public Task AddWalletAsync(Wallet wallet, CancellationToken token);
    public Task SaveUserFundsWithInboxAsync(ProcessedMessage message, CancellationToken token);
}
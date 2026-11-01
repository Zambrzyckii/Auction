using AuctionServer.Modules.Wallets.Domain.Entities;
using AuctionServer.Shared.Infrastructure.Outbox;

namespace AuctionServer.Modules.Wallets.Application.Interfaces.Persistence;

public interface IWalletRepository
{
    public Task SaveUserFundsAsync(CancellationToken token);
    public Task<Wallet> GetUserWalletByIdAsync(Guid userPublicId, CancellationToken token);

    public Task<Wallet> GetUserWalletByIdAsyncReadOnly(Guid userPublicId, CancellationToken token);

    public Task AddWalletAsync(Wallet wallet, CancellationToken token);
    public Task SaveTransferAsync(Transfer transfer, CancellationToken token);
    public Task<List<Transfer>> GetUserTransfersReadOnlyAsync(Guid userPublicId, CancellationToken token);
    public Task ApplyOnceAsync(Guid eventId, Func<Task> change, CancellationToken token);
    public Task ApplyOnceAsync(Guid eventId, Func<Task<OutboxMessage?>> change, CancellationToken token);
}
using AuctionServer.Modules.Wallets.Domain.Enums;
using AuctionServer.Modules.Wallets.Domain.Exceptions;

namespace AuctionServer.Modules.Wallets.Domain.Entities;

public sealed class Wallet
{
    public Guid UserId { get; init; }
    public decimal AvailableFunds { get; private set; }
    public decimal LockedFunds { get; private set; }

    public bool IsSuspendedWallet { get; private set; }
    public Guid Version { get; private set; } = Guid.NewGuid();
    private readonly List<FundsLock> _fundsLocks = [];
    
    public IReadOnlyCollection<FundsLock> FundsLocks => _fundsLocks;
    public void SuspendAccount() => IsSuspendedWallet = true;
    public void UnsuspendAccount() => IsSuspendedWallet = false;

    public void AddFunds(decimal amount)
    {
        if (amount <= 0) throw new WalletExceptions.InvalidAmountException();

        AvailableFunds += amount;
        Version = Guid.NewGuid();
    }

    public void Withdraw(decimal amount)
    {
        if (amount <= 0) throw new WalletExceptions.InvalidAmountException();
        if (AvailableFunds < amount) throw new WalletExceptions.InsufficientFundsException();

        AvailableFunds -= amount;
        Version = Guid.NewGuid();
    }

    
    public void LockFunds(Guid publicAuctionId, decimal amount)
    {
        if (amount <= 0) throw new WalletExceptions.InvalidAmountException();
        if (AvailableFunds < amount) throw new WalletExceptions.InsufficientFundsException();
        if (_fundsLocks.Any(l => l.PublicAuctionId == publicAuctionId && l.Status == FundsLockStatus.Active))
            throw new WalletExceptions.LockAlreadyExistsException();

        _fundsLocks.Add(new FundsLock { PublicAuctionId = publicAuctionId, Amount = amount });
        AvailableFunds -= amount;
        LockedFunds += amount;
        Version = Guid.NewGuid();
    }

    public void ReleaseLock(Guid publicAuctionId)
    {
        var fundsLock = GetActiveLock(publicAuctionId);
        fundsLock.Release();
        LockedFunds -= fundsLock.Amount;
        AvailableFunds += fundsLock.Amount;
        Version = Guid.NewGuid();
    }

    public void SpendLock(Guid publicAuctionId, decimal amount)
    {
        if (amount <= 0) throw new WalletExceptions.InvalidAmountException();
        var fundsLocked = GetActiveLock(publicAuctionId);
        if (amount > fundsLocked.Amount) throw new WalletExceptions.InvalidAmountException();
        fundsLocked.Consume();
        LockedFunds -= fundsLocked.Amount;
        AvailableFunds += fundsLocked.Amount - amount;
        Version = Guid.NewGuid();
    }

    public decimal ConsumeLock(Guid publicAuctionId)
    {
        var fundsLock = GetActiveLock(publicAuctionId);
        fundsLock.Consume();
        LockedFunds -= fundsLock.Amount;
        Version = Guid.NewGuid();
        return fundsLock.Amount;
    }

    private FundsLock GetActiveLock(Guid publicAuctionId) =>
        _fundsLocks.SingleOrDefault(l => l.PublicAuctionId == publicAuctionId && l.Status == FundsLockStatus.Active)
        ?? throw new WalletExceptions.LockNotFoundException(publicAuctionId);
}
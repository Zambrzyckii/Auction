using AuctionServer.Modules.Wallets.Domain.Exceptions;

namespace AuctionServer.Modules.Wallets.Domain.Entities;

public sealed class Wallet
{
    public Guid UserId { get; init; }
    public decimal AvailableFunds { get; private set; }
    public decimal LockedFunds { get; private set; }

    public bool IsSuspendedWallet { get; private set; }
    public Guid Version { get; private set; } = Guid.NewGuid();
    
    public void LockFunds(decimal amount)
    {
        if (amount <= 0) throw new WalletExceptions.InvalidAmountException();
        if (AvailableFunds < amount) throw new WalletExceptions.InsufficientFundsException();

        AvailableFunds -= amount;
        LockedFunds += amount;
        Version = Guid.NewGuid();
    }

    public void UnlockFunds(decimal amount)
    {
        if (amount <= 0) throw new WalletExceptions.InvalidAmountException();
        if (LockedFunds < amount) throw new WalletExceptions.InsufficientLockedFundsException();

        LockedFunds -= amount;
        AvailableFunds += amount;
        Version = Guid.NewGuid();
    }
    
    public void SuspendAccount() => IsSuspendedWallet = true;
    public void UnsuspendAccount() => IsSuspendedWallet = false;

    public void AddFunds(decimal amount)
    {
        if (amount <= 0) throw new WalletExceptions.InvalidAmountException();

        AvailableFunds += amount;
        Version = Guid.NewGuid();
    }
}
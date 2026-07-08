using AuctionServer.Modules.Wallets.Domain.Exceptions;

namespace AuctionServer.Modules.Wallets.Domain.Entities;

public sealed class Wallet
{
    public Guid UserId { get; init; }
    public decimal AvailableFunds { get; private set; }
    public decimal LockedFunds { get; private set; }

    public bool IsSuspendedWallet { get; private set; }
    
    public void LockFunds(decimal amount)
    {
        if (AvailableFunds < amount) throw new WalletExceptions.InsufficientFundsException();

        AvailableFunds -= amount;
        LockedFunds += amount;
    }

    public void SuspendAccount() => IsSuspendedWallet = true;
    public void UnsuspendAccount() => IsSuspendedWallet = false;
}
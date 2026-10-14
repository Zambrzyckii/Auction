using AuctionServer.Modules.Wallets.Domain.Enums;

namespace AuctionServer.Modules.Wallets.Domain.Entities;

public sealed class FundsLock
{
    public int Id { get; init; }
    public Guid PublicAuctionId { get; init; }
    public decimal Amount { get; init; }
    public FundsLockStatus Status { get; private set; } = FundsLockStatus.Active;

    internal void Release() => Status = FundsLockStatus.Released;
    internal void Consume() => Status = FundsLockStatus.Consumed;
}
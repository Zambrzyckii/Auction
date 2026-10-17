using AuctionServer.Modules.Casino.Domain.Enums;
using AuctionServer.Modules.Casino.Domain.Exceptions;

namespace AuctionServer.Modules.Casino.Domain.Entities;

public sealed class ChipPurchase
{
    public int Id { get; init; }
    public Guid PublicPurchaseId { get; init; } = Guid.NewGuid();
    public Guid UserId { get; init; }
    public decimal Amount { get; init; }
    public ChipPurchaseStatus Status { get; private set; } = ChipPurchaseStatus.Pending;
    public DateTime RequestedOn { get; init; } = DateTime.UtcNow;
    public DateTime? ResolvedOn { get; private set; }
    public string? RejectionReason { get; private set; }
    public Guid Version { get; private set; } = Guid.NewGuid();

    public static ChipPurchase Request(Guid userId, decimal amount, DateTime now)
    {
        if (amount <= 0 || amount != decimal.Truncate(amount)) throw new CasinoExceptions.InvalidChipAmountException();

        return new ChipPurchase { UserId = userId, Amount = amount, RequestedOn = now };
    }

    public void Complete(DateTime now)
    {
        if (Status == ChipPurchaseStatus.Rejected || Status == ChipPurchaseStatus.Completed)
            throw new CasinoExceptions.InvalidPurchaseStateTransitionException(Status);

        Status = ChipPurchaseStatus.Completed;
        RejectionReason = null;
        Resolve(now);
    }

    public void Reject(string reason, DateTime now)
    {
        if (Status == ChipPurchaseStatus.Expired) return;
        if (Status != ChipPurchaseStatus.Pending)
            throw new CasinoExceptions.InvalidPurchaseStateTransitionException(Status);

        Status = ChipPurchaseStatus.Rejected;
        RejectionReason = reason;
        Resolve(now);
    }

    public void Expire(DateTime now)
    {
        if (Status != ChipPurchaseStatus.Pending)
            throw new CasinoExceptions.InvalidPurchaseStateTransitionException(Status);

        Status = ChipPurchaseStatus.Expired;
        RejectionReason = "Purchase timed out";
        Resolve(now);
    }

    private void Resolve(DateTime now)
    {
        ResolvedOn = now;
        Version = Guid.NewGuid();
    }
}

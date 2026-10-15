using AuctionServer.Modules.Pawnshop.Domain.Enums;
using AuctionServer.Modules.Pawnshop.Domain.Exceptions;

namespace AuctionServer.Modules.Pawnshop.Domain.Entities;

public sealed class Shop
{
    public int Id { get; init; }
    public Guid PublicPawnshopId { get; init; } = Guid.NewGuid();
    public Guid UserId { get; init; }
    public ShopStatus Status { get; private set; } = ShopStatus.PendingPayment;
    public DateTime RequestedOn { get; init; } = DateTime.UtcNow;
    public DateTime? ActivatedOn { get; private set; }
    public string? RejectionReason { get; private set; }
    public Guid? PendingPaymentId { get; private set; }
    public DateTime? PendingPaymentRequestedOn { get; private set; }
    public Guid Version { get; private set; } = Guid.NewGuid();

    public static Shop Open(Guid userId, DateTime now)
    {
        return new Shop
        {
            UserId = userId,
            RequestedOn = now,
            PendingPaymentId = Guid.NewGuid(),
            PendingPaymentRequestedOn = now
        };
    }

    public void CompletePayment(Guid paymentId, DateTime now)
    {
        if (PendingPaymentId != paymentId)
            throw new PawnshopExceptions.InvalidShopStateTransitionException(Status);

        Status = ShopStatus.Active;
        ActivatedOn = now;
        RejectionReason = null;
        ClearPendingPayment();
    }

    public void RejectPayment(Guid paymentId, string reason)
    {
        if (PendingPaymentId != paymentId)
            throw new PawnshopExceptions.InvalidShopStateTransitionException(Status);

        Status = ShopStatus.Rejected;
        RejectionReason = reason;
        ClearPendingPayment();
    }

    public void ExpirePayment()
    {
        if (PendingPaymentId == null)
            throw new PawnshopExceptions.InvalidShopStateTransitionException(Status);

        RejectPayment(PendingPaymentId.Value, "Payment timed out");
    }

    private void ClearPendingPayment()
    {
        PendingPaymentId = null;
        PendingPaymentRequestedOn = null;
        Version = Guid.NewGuid();
    }
}

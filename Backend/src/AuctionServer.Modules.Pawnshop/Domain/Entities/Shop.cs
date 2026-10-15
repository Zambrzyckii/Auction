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
    public string? BotTierName { get; private set; }
    public PawnshopRarity? BotRarity { get; private set; }
    public TimeSpan? BotSpawnInterval { get; private set; }
    public decimal? BotPayoutRate { get; private set; }
    public DateTime? BotPurchasedOn { get; private set; }
    public DateTime? NextSpawnOn { get; private set; }
    public string? PendingBotTierName { get; private set; }
    public PawnshopRarity? PendingBotRarity { get; private set; }
    public TimeSpan? PendingBotSpawnInterval { get; private set; }
    public decimal? PendingBotPayoutRate { get; private set; }
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

        if (Status == ShopStatus.PendingPayment)
        {
            Status = ShopStatus.Active;
            ActivatedOn = now;
        }
        else
        {
            BotTierName = PendingBotTierName;
            BotRarity = PendingBotRarity;
            BotSpawnInterval = PendingBotSpawnInterval;
            BotPayoutRate = PendingBotPayoutRate;
            BotPurchasedOn = now;
            NextSpawnOn = now + PendingBotSpawnInterval!.Value;
            ClearPendingBot();
        }

        RejectionReason = null;
        ClearPendingPayment();
    }

    public void RejectPayment(Guid paymentId, string reason)
    {
        if (PendingPaymentId != paymentId)
            throw new PawnshopExceptions.InvalidShopStateTransitionException(Status);

        if (Status == ShopStatus.PendingPayment) Status = ShopStatus.Rejected;
        else ClearPendingBot();

        RejectionReason = reason;
        ClearPendingPayment();
    }

    public void ExpirePayment()
    {
        if (PendingPaymentId == null)
            throw new PawnshopExceptions.InvalidShopStateTransitionException(Status);

        RejectPayment(PendingPaymentId.Value, "Payment timed out");
    }

    public Guid BeginBotPurchase(string tierName, PawnshopRarity rarity, TimeSpan spawnInterval, decimal payoutRate,
        DateTime now)
    {
        if (Status != ShopStatus.Active) throw new PawnshopExceptions.PawnshopNotActiveException();
        if (PendingPaymentId is not null) throw new PawnshopExceptions.PaymentInProgressException();
        if (BotRarity is not null && rarity <= BotRarity) throw new PawnshopExceptions.BotNotAnUpgradeException();

        PendingBotTierName = tierName;
        PendingBotRarity = rarity;
        PendingBotSpawnInterval = spawnInterval;
        PendingBotPayoutRate = payoutRate;
        RejectionReason = null;
        PendingPaymentId = Guid.NewGuid();
        PendingPaymentRequestedOn = now;
        Version = Guid.NewGuid();
        return PendingPaymentId.Value;
    }

    private void ClearPendingBot()
    {
        PendingBotTierName = null;
        PendingBotRarity = null;
        PendingBotSpawnInterval = null;
        PendingBotPayoutRate = null;
    }

    private void ClearPendingPayment()
    {
        PendingPaymentId = null;
        PendingPaymentRequestedOn = null;
        Version = Guid.NewGuid();
    }
}

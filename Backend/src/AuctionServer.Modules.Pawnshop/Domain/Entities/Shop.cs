using AuctionServer.Modules.Pawnshop.Domain.Enums;
using AuctionServer.Modules.Pawnshop.Domain.Exceptions;
using AuctionServer.Shared.Integration.Events.Pawnshop;

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
    public Guid? PendingStockRequestId { get; private set; }
    public DateTime? PendingStockRequestedOn { get; private set; }
    public decimal? PendingStockPayoutRate { get; private set; }
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
        if (PendingPaymentId is null)
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

    public (Guid RequestId, PawnshopRarity Rarity) RequestSpawn(DateTime now)
    {
        if (Status != ShopStatus.Active) throw new PawnshopExceptions.InvalidShopStateTransitionException(Status);
        if (BotRarity is null) throw new PawnshopExceptions.InvalidShopStateTransitionException(Status);
        if (PendingStockRequestId is not null) throw new PawnshopExceptions.InvalidShopStateTransitionException(Status);
        if (NextSpawnOn > now) throw new PawnshopExceptions.InvalidShopStateTransitionException(Status);

        PendingStockRequestId = Guid.NewGuid();
        PendingStockRequestedOn = now;
        PendingStockPayoutRate = BotPayoutRate;
        NextSpawnOn = now + BotSpawnInterval!.Value;
        Version = Guid.NewGuid();
        return (PendingStockRequestId.Value, BotRarity.Value);
    }

    public IReadOnlyList<StockItem> ReceiveStock(Guid requestId, IReadOnlyList<PawnshopStockItem> stock,
        TimeSpan sellDelay, DateTime now)
    {
        if (PendingStockRequestId != requestId)
            throw new PawnshopExceptions.InvalidShopStateTransitionException(Status);
        if (stock.Count == 0)
            throw new PawnshopExceptions.InvalidStockException();

        var payoutRate = PendingStockPayoutRate!.Value;
        var items = stock.Select(s => new StockItem
        {
            PublicPawnshopId = PublicPawnshopId,
            UserId = UserId,
            Name = s.Name,
            Rarity = Enum.Parse<PawnshopRarity>(s.Rarity),
            Price = s.Price,
            PayoutRate = payoutRate,
            SpawnedOn = now,
            SellAfter = now + sellDelay
        }).ToList();

        ClearPendingStockRequest();
        return items;
    }

    public void ExpireStockRequest()
    {
        if (PendingStockRequestId is null)
            throw new PawnshopExceptions.InvalidShopStateTransitionException(Status);

        ClearPendingStockRequest();
    }

    private void ClearPendingStockRequest()
    {
        PendingStockRequestId = null;
        PendingStockRequestedOn = null;
        PendingStockPayoutRate = null;
        Version = Guid.NewGuid();
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

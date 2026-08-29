using AuctionServer.Modules.Auctions.Domain.Enums;
using AuctionServer.Modules.Auctions.Domain.Exceptions;

namespace AuctionServer.Modules.Auctions.Domain.Entities;

public sealed class Auction
{
    private static readonly TimeSpan AntiSnipingWindow = TimeSpan.FromSeconds(30);
    public Guid PublicAuctionId { get; init; } = Guid.NewGuid();
    
    public Guid SellerUserId { get; init; }
    public Guid ItemId { get; init; }
    public Guid? CurrentWinningUserId { get; private set; }
    public int AuctionId { get; init; }
    public decimal CurrentPrice { get; private set; } = 1;
    public AuctionStatus Status { get; private set; }
    public string? ItemName { get; private set; }
    public string? ItemRarity { get; private set; }
    public decimal? ItemOfficialPrice { get; private set; }
    public string? CancellationReason { get; private set; }
    public DateTime EndsOn { get; private set; } = DateTime.UtcNow.AddMinutes(1);
    public Guid Version { get; private set; } = Guid.NewGuid();
    public void ApplyNewBid(Guid bidderId, decimal amount)
    {
        if (Status is AuctionStatus.Pending) throw new AuctionExceptions.AuctionNotActiveException(Status);
        if (Status is not AuctionStatus.Active) throw new AuctionExceptions.AuctionClosedException();
        if (DateTime.UtcNow >= EndsOn) throw new AuctionExceptions.AuctionClosedException();
        if (amount <= CurrentPrice) throw new AuctionExceptions.InvalidBidException();
        if (bidderId == SellerUserId) throw new AuctionExceptions.CannotBidOwnItemException();
        if (bidderId == CurrentWinningUserId) throw new AuctionExceptions.AlreadyHighestBidderException();

        CurrentWinningUserId = bidderId;
        CurrentPrice = amount;
        if (EndsOn < DateTime.UtcNow + AntiSnipingWindow) EndsOn += AntiSnipingWindow;
        Version = Guid.NewGuid();
    }
    
    public static Auction Create(Guid sellerId, Guid itemId, decimal startingPrice, DateTime endsOn)
    {
        if (startingPrice <= 0) throw new AuctionExceptions.InvalidStartingPriceException();
        if (endsOn < DateTime.UtcNow.AddMinutes(1)) throw new AuctionExceptions.InvalidAuctionEndDateException();
        return new Auction { SellerUserId = sellerId, ItemId = itemId, CurrentPrice = startingPrice, EndsOn = endsOn, Status = AuctionStatus.Pending };
    }

    public void CloseAuction()
    {
        EnsureStatus(AuctionStatus.Active, nameof(CloseAuction));
        Status = AuctionStatus.Closed;
        Version = Guid.NewGuid();
    }

    public void Activate(string itemName, string itemRarity, decimal itemOfficialPrice)
    {
        EnsureStatus(AuctionStatus.Pending, nameof(Activate));
        ItemName = itemName;
        ItemRarity = itemRarity;
        ItemOfficialPrice = itemOfficialPrice;
        Status = AuctionStatus.Active;
        Version = Guid.NewGuid();
    }

    public void Cancel(string reason)
    {
        EnsureStatus(AuctionStatus.Pending, nameof(Cancel));
        CancellationReason = reason;
        Status = AuctionStatus.Cancelled;
        Version = Guid.NewGuid();
    }

    private void EnsureStatus(AuctionStatus expected, string action)
    {
        if (Status != expected) throw new AuctionExceptions.InvalidAuctionStateTransitionException(Status, action);
    }
}

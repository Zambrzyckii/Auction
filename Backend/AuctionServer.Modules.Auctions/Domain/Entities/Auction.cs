using AuctionServer.Modules.Auctions.Domain.Exceptions;

namespace AuctionServer.Modules.Auctions.Domain.Entities;

public sealed class Auction
{
    public Guid PublicAuctionId { get; init; } = Guid.NewGuid();
    
    public Guid SellerUserId { get; init; }
    public Guid ItemId { get; init; }
    public Guid? CurrentWinningUserId { get; private set; }
    public int AuctionId { get; init; }
    public decimal CurrentPrice { get; private set; } = 1;
    public bool IsClosed { get; private set; }
    public DateTime EndsOn { get; private set; } = DateTime.UtcNow.AddMinutes(1);

    public void ApplyNewBid(Guid bidderId, decimal amount)
    {
        if (IsClosed) throw new AuctionExceptions.AuctionClosedException();
        if (amount <= CurrentPrice) throw new AuctionExceptions.InvalidBidException();
        if (DateTime.UtcNow >= EndsOn) throw new AuctionExceptions.AuctionClosedException();
        if (bidderId == SellerUserId) throw new AuctionExceptions.CannotBidOwnItemException();
        if (bidderId == CurrentWinningUserId) throw new AuctionExceptions.AlreadyHighestBidderException();

        CurrentWinningUserId = bidderId;
        CurrentPrice = amount;
    }
    
    public static Auction Create(Guid sellerId, Guid itemId, Decimal startingPrice, DateTime endsOn)
    {
        if (startingPrice <= 0) throw new AuctionExceptions.InvalidStartingPriceException();
        if (endsOn < DateTime.UtcNow.AddMinutes(1)) throw new AuctionExceptions.AuctionInvalidExtendDateException();
        return new Auction { SellerUserId = sellerId, ItemId = itemId, CurrentPrice = startingPrice, EndsOn = endsOn };
    }

    public void CloseAuction()
    {
        IsClosed = true;
    }
}
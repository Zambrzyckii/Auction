using AuctionServer.Modules.Auctions.Domain.Exceptions;

namespace AuctionServer.Modules.Auctions.Domain.Entities;

public sealed class Auction
{
    public Guid PublicAuctionId { get; init; }
    
    public Guid SellerUserId { get; init; }
    public Guid ItemId { get; init; }
    public Guid? CurrentWinningUserId { get; private set; }
    public int AuctionId { get; init; }
    public decimal CurrentPrice { get; private set; } = 1;
    public bool IsClosed { get; private set; }

    public void ApplyNewBid(Guid bidderId, decimal amount)
    {
        if (IsClosed) throw new AuctionExceptions.AuctionClosedException();
        if (amount <= CurrentPrice) throw new AuctionExceptions.InvalidBidException();

        if (bidderId == SellerUserId) throw new AuctionExceptions.CannotBidOwnItemException();
        if (bidderId == CurrentWinningUserId) throw new AuctionExceptions.AlreadyHighestBidderException();

        CurrentWinningUserId = bidderId;
        CurrentPrice = amount;
    }

    public void CloseAuction()
    {
        IsClosed = true;
    }
}
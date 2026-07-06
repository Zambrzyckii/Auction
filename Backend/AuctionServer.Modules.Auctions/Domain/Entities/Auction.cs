namespace AuctionServer.Modules.Auctions.Domain.Entities;

public sealed class Auction
{
    public Guid PublicAuctionId { get; init; }
    public int AuctionId { get; init; }
    public decimal CurrentPrice { get; private set; } = 1;
    public bool IsClosed { get; private set; } = false;

    public void ApplyNewBid(decimal amount)
    {
        if (IsClosed) return;
        if (amount <= CurrentPrice) return;
        CurrentPrice = amount;
    }
}
namespace AuctionServer.Modules.Auctions.Domain.Entities;

public class Bid
{
    public int Id { get; init; }
    public Guid PublicAuctionId { get; init; }
    public Guid BidderUserId { get; init; }
    public decimal Amount { get; init; }
    public DateTime PlacedOn { get; init; } = DateTime.UtcNow;
}

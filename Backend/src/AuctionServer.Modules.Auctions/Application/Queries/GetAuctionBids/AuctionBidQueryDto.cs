namespace AuctionServer.Modules.Auctions.Application.Queries.GetAuctionBids;

public record AuctionBidQueryDto(
    Guid BidderUserId,
    decimal Amount,
    DateTime PlacedOn);

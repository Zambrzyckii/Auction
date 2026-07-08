namespace AuctionServer.Modules.Auctions.Presentation.Request;

public record PlaceBidRequest(Guid BidderId, decimal Amount);

namespace AuctionServer.Modules.Auctions.Presentation.Request;

public record CreateAuctionRequest(Guid ItemId, decimal StartingPrice, DateTimeOffset EndsOn);
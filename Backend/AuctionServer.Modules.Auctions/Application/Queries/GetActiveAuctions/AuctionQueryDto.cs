namespace AuctionServer.Modules.Auctions.Application.Queries.GetActiveAuctions;

public record AuctionQueryDto(Guid PublicAuctionId, decimal CurrentPrice);
using AuctionServer.Shared.Integration.Exceptions;

namespace AuctionServer.Modules.Auctions.Domain.Exceptions;

public static class AuctionExceptions
{
    public class InvalidBidException() : AppException("Price must be higher than current price",400);
    public class AuctionClosedException() : AppException("This auction is closed", 400);
    public class CannotBidOwnItemException() : AppException("Cannot bid own item", 400);
    public class AlreadyHighestBidderException() : AppException("Bidder is already the highest bidder", 400);
    public class AuctionNotFoundException(Guid publicAuctionId) : AppException($"Auction {publicAuctionId} not found", 404);
}
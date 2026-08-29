using AuctionServer.Modules.Auctions.Domain.Enums;
using AuctionServer.Shared.Integration.Exceptions;

namespace AuctionServer.Modules.Auctions.Domain.Exceptions;

public static class AuctionExceptions
{
    public class InvalidBidException() : AppException("Price must be higher than current price",400);
    public class InvalidStartingPriceException() : AppException("Starting price must be higher than 0",400);
    public class AuctionClosedException() : AppException("This auction is closed", 400);
    public class CannotBidOwnItemException() : AppException("Cannot bid own item", 400);
    public class AlreadyHighestBidderException() : AppException("Bidder is already the highest bidder", 400);
    public class AuctionNotFoundException(Guid publicAuctionId) : AppException($"Auction {publicAuctionId} not found", 404);
    public class AuctionAlreadyExistException() : AppException("Auction already exist", 409);
    public class InvalidAuctionEndDateException() : AppException("End date must be at least one minute in the future", 400);
    public class AuctionNotActiveException(AuctionStatus status) : AppException($"Auction is not active, current status: {status}", 400);
    public class InvalidAuctionStateTransitionException(AuctionStatus status, string action) : AppException($"Cannot {action} an auction in status {status}", 409);
}
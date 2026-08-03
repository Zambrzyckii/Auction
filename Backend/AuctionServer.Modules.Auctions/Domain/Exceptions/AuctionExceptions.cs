namespace AuctionServer.Modules.Auctions.Domain.Exceptions;

public static class AuctionExceptions
{
    public class InvalidBidException() : ApplicationException("Price must be higher than current price");
    public class AuctionClosedException() : ApplicationException("Auction must be active offer");
    public class CannotBidOwnItemException() : ApplicationException("Cannot bid own item");
    public class AuctionNotFoundException(Guid publicAuctionId) : ApplicationException($"Auction {publicAuctionId} not found");
}
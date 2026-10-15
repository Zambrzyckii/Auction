using AuctionServer.Modules.Warehouses.Domain.Enums;
using AuctionServer.Shared.Integration.Exceptions;

namespace AuctionServer.Modules.Warehouses.Domain.Exceptions;

public static class WarehouseExceptions
{
    public class WarehouseNotFoundException(Guid publicWarehouseId)
        : AppException($"Warehouse war {publicWarehouseId} doesn't exist", 404);

    public class WarNotStockingException(WarehouseWarStatus status)
        : AppException($"Warehouse war is not awaiting stock, current status: {status}", 409);

    public class InvalidEntryFeeException() : AppException("Entry fee must be greater than zero", 400);

    public class InvalidEstimateException() : AppException("Estimates must be positive and min cannot exceed max", 400);

    public class EventAlreadyProcessedException() : AppException("Event was already processed", 409);

    public class WarNotOpenException(WarehouseWarStatus status)
        : AppException($"Warehouse war is not open, current status: {status}", 409);

    public class JoinCountdownFinishedException() : AppException("Bidding countdown has already finished", 409);

    public class AlreadyParticipantException() : AppException("User already joined this warehouse war", 409);

    public class WarehouseFullException() : AppException("Warehouse war lobby is full", 409);

    public class ParticipantNotFoundException() : AppException("User is not a participant of this warehouse war", 404);

    public class InvalidWarStateTransitionException(WarehouseWarStatus from, WarehouseWarStatus to)
        : AppException($"Warehouse war cannot move from {from} to {to}", 409);

    public class CountdownNotStartedException() : AppException("Bidding countdown has not been scheduled", 409);

    public class NotEnoughPlayersException() : AppException("Warehouse war is below the player minimum", 409);

    public class WarNotBiddingException(WarehouseWarStatus status)
        : AppException($"Warehouse war is not in bidding, current status: {status}", 409);

    public class RaiseWindowClosedException() : AppException("Raise window has already closed", 409);

    public class ParticipantNotActiveException() : AppException("Entry fee is not confirmed yet", 409);

    public class AlreadyLeadingException() : AppException("Current leader cannot raise own bid", 409);

    public class InvalidIncrementException() : AppException("Increment is not allowed for this tier", 400);

    public class BudgetExceededException() : AppException("Raise would exceed the entry fee budget", 400);

    public class NoLeaderException() : AppException("Warehouse war has no leading bid to settle", 409);
}

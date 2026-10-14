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
}

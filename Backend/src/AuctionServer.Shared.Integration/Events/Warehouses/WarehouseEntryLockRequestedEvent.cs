using MediatR;

namespace AuctionServer.Shared.Integration.Events.Warehouses;

public record WarehouseEntryLockRequestedEvent(Guid EventId, Guid PublicWarehouseId, Guid UserId, decimal Amount) : INotification;

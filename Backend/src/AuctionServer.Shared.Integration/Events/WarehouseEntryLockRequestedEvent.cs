using MediatR;

namespace AuctionServer.Shared.Integration.Events;

public record WarehouseEntryLockRequestedEvent(Guid EventId, Guid PublicWarehouseId, Guid UserId, decimal Amount) : INotification;

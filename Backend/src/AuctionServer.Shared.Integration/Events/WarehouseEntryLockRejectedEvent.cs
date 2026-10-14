using MediatR;

namespace AuctionServer.Shared.Integration.Events;

public record WarehouseEntryLockRejectedEvent(Guid EventId, Guid PublicWarehouseId, Guid UserId, string Reason) : INotification;

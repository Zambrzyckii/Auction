using MediatR;

namespace AuctionServer.Shared.Integration.Events;

public record WarehouseEntryLockedEvent(Guid EventId, Guid PublicWarehouseId, Guid UserId) : INotification;

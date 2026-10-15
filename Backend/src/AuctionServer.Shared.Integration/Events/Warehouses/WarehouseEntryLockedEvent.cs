using MediatR;

namespace AuctionServer.Shared.Integration.Events.Warehouses;

public record WarehouseEntryLockedEvent(Guid EventId, Guid PublicWarehouseId, Guid UserId) : INotification;

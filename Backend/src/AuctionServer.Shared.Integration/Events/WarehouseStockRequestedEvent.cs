using MediatR;

namespace AuctionServer.Shared.Integration.Events;

public record WarehouseStockRequestedEvent(Guid EventId, Guid PublicWarehouseId, IReadOnlyList<string> Rarities) : INotification;

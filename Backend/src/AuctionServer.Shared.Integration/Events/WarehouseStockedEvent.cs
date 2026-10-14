using MediatR;

namespace AuctionServer.Shared.Integration.Events;

public record WarehouseStockedEvent(Guid EventId, Guid PublicWarehouseId, IReadOnlyList<WarehouseStockItem> Stock) : INotification;

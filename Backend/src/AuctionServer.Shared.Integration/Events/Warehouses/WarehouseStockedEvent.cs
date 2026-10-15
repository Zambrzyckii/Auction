using MediatR;

namespace AuctionServer.Shared.Integration.Events.Warehouses;

public record WarehouseStockedEvent(Guid EventId, Guid PublicWarehouseId, IReadOnlyList<WarehouseStockItem> Stock) : INotification;

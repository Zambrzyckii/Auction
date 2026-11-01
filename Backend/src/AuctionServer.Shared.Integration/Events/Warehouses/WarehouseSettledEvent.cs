using MediatR;

namespace AuctionServer.Shared.Integration.Events.Warehouses;

public record WarehouseSettledEvent(
    Guid EventId,
    Guid PublicWarehouseId,
    Guid WinnerUserId,
    IReadOnlyList<WarehouseStockItem> Stock) : INotification;

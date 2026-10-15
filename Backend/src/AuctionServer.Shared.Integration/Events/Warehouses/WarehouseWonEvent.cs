using MediatR;

namespace AuctionServer.Shared.Integration.Events.Warehouses;

public record WarehouseWonEvent(
    Guid EventId,
    Guid PublicWarehouseId,
    Guid WinnerUserId,
    decimal FinalPrice,
    IReadOnlyList<WarehouseStockItem> Stock) : INotification;

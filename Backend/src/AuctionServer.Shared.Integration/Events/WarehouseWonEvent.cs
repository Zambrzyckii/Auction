using MediatR;

namespace AuctionServer.Shared.Integration.Events;

public record WarehouseWonEvent(
    Guid EventId,
    Guid PublicWarehouseId,
    Guid WinnerUserId,
    decimal FinalPrice,
    IReadOnlyList<WarehouseStockItem> Stock) : INotification;

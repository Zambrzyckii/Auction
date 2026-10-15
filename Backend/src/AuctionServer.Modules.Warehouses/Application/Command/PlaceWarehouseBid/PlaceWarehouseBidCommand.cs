using MediatR;

namespace AuctionServer.Modules.Warehouses.Application.Command.PlaceWarehouseBid;

public record PlaceWarehouseBidCommand(Guid PublicWarehouseId, Guid UserId, decimal Increment) : IRequest;

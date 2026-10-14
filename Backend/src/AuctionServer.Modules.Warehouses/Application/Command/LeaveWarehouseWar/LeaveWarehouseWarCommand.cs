using MediatR;

namespace AuctionServer.Modules.Warehouses.Application.Command.LeaveWarehouseWar;

public record LeaveWarehouseWarCommand(Guid PublicWarehouseId, Guid UserId) : IRequest;

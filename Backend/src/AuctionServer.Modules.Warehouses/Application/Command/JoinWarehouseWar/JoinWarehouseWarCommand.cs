using MediatR;

namespace AuctionServer.Modules.Warehouses.Application.Command.JoinWarehouseWar;

public record JoinWarehouseWarCommand(Guid PublicWarehouseId, Guid UserId) : IRequest;

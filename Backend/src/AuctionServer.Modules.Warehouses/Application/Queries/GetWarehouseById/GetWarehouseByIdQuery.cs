using MediatR;

namespace AuctionServer.Modules.Warehouses.Application.Queries.GetWarehouseById;

public record GetWarehouseByIdQuery(Guid PublicWarehouseId, Guid CallerId) : IRequest<WarehouseDetailsDto>;

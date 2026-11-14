using MediatR;

namespace AuctionServer.Modules.Warehouses.Application.Queries.GetMyWarehouses;

public record GetMyWarehousesQuery(Guid UserId) : IRequest<List<MyWarehouseDto>>;

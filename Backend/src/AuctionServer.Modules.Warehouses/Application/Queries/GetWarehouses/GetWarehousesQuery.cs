using MediatR;

namespace AuctionServer.Modules.Warehouses.Application.Queries.GetWarehouses;

public record GetWarehousesQuery(int Limit) : IRequest<List<WarehouseSummaryDto>>;

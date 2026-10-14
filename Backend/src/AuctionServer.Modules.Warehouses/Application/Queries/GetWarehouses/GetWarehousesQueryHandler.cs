using AuctionServer.Modules.Warehouses.Application.Interfaces;
using AuctionServer.Modules.Warehouses.Application.Options;
using MediatR;

namespace AuctionServer.Modules.Warehouses.Application.Queries.GetWarehouses;

public class GetWarehousesQueryHandler(IWarehouseRepository repository, WarehousesOptions options)
    : IRequestHandler<GetWarehousesQuery, List<WarehouseSummaryDto>>
{
    public async Task<List<WarehouseSummaryDto>> Handle(GetWarehousesQuery request, CancellationToken token)
    {
        var wars = await repository.GetActiveWarsReadOnlyAsync(request.Limit, token);
        var stockCounts = await repository.GetStockCountsReadOnlyAsync(
            wars.Select(w => w.PublicWarehouseId).ToList(), token);

        return wars.Select(war => new WarehouseSummaryDto(
            war.PublicWarehouseId,
            war.Tier,
            war.Status,
            war.EstimateMin,
            war.EstimateMax,
            war.EntryFee,
            war.CurrentPrice,
            stockCounts.GetValueOrDefault(war.PublicWarehouseId),
            war.Participants.Count,
            options.MaxPlayers,
            war.BiddingStartsOn,
            war.BiddingEndsOn)).ToList();
    }
}

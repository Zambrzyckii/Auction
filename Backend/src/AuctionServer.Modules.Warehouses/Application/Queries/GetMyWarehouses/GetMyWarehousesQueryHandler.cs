using AuctionServer.Modules.Warehouses.Application.Interfaces;
using MediatR;

namespace AuctionServer.Modules.Warehouses.Application.Queries.GetMyWarehouses;

public class GetMyWarehousesQueryHandler(IWarehouseRepository repository)
    : IRequestHandler<GetMyWarehousesQuery, List<MyWarehouseDto>>
{
    private const int MaxRows = 50;

    public async Task<List<MyWarehouseDto>> Handle(GetMyWarehousesQuery request, CancellationToken token)
    {
        var wars = await repository.GetWarsForParticipantReadOnlyAsync(request.UserId, MaxRows, token);
        var stockCounts = await repository.GetStockCountsReadOnlyAsync(
            wars.Select(w => w.PublicWarehouseId).ToList(), token);

        return wars.Select(war => new MyWarehouseDto(
            war.PublicWarehouseId,
            war.Tier,
            war.Status,
            war.EntryFee,
            war.CurrentPrice,
            stockCounts.GetValueOrDefault(war.PublicWarehouseId),
            war.Participants.Count,
            war.BiddingEndsOn,
            war.CurrentLeaderId == request.UserId,
            war.Participants.Single(p => p.UserId == request.UserId).State,
            war.CancellationReason)).ToList();
    }
}

using AuctionServer.Modules.Warehouses.Application.Interfaces;
using AuctionServer.Modules.Warehouses.Application.Options;
using MediatR;

namespace AuctionServer.Modules.Warehouses.Application.Queries.GetWarehouseById;

public class GetWarehouseByIdQueryHandler(IWarehouseRepository repository, WarehousesOptions options)
    : IRequestHandler<GetWarehouseByIdQuery, WarehouseDetailsDto>
{
    public async Task<WarehouseDetailsDto> Handle(GetWarehouseByIdQuery request, CancellationToken token)
    {
        var war = await repository.GetWarByPublicIdReadOnlyAsync(request.PublicWarehouseId, token);
        var stockCounts = await repository.GetStockCountsReadOnlyAsync([war.PublicWarehouseId], token);
        var participant = war.Participants.SingleOrDefault(p => p.UserId == request.CallerId);

        return new WarehouseDetailsDto(
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
            war.BiddingEndsOn,
            participant is not null,
            participant?.State,
            war.CurrentLeaderId == request.CallerId);
    }
}

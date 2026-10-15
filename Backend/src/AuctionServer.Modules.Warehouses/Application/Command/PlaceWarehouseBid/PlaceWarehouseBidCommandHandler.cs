using AuctionServer.Modules.Warehouses.Application.Interfaces;
using AuctionServer.Modules.Warehouses.Application.Options;
using MediatR;

namespace AuctionServer.Modules.Warehouses.Application.Command.PlaceWarehouseBid;

public class PlaceWarehouseBidCommandHandler(IWarehouseRepository repository, WarehousesOptions options)
    : IRequestHandler<PlaceWarehouseBidCommand>
{
    public async Task Handle(PlaceWarehouseBidCommand request, CancellationToken token)
    {
        var war = await repository.GetWarByPublicIdAsync(request.PublicWarehouseId, token);
        var tier = options.Tiers.Single(t => t.Name == war.Tier);

        war.Raise(request.UserId, request.Increment, tier.Increments, options.RaiseWindow);
        await repository.SaveWarAsync(token);
    }
}

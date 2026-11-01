using AuctionServer.Modules.Warehouses.Application.Estimates;
using AuctionServer.Modules.Warehouses.Application.Interfaces;
using AuctionServer.Modules.Warehouses.Application.Options;
using AuctionServer.Modules.Warehouses.Domain.Entities;
using AuctionServer.Shared.Integration.Events.Warehouses;
using MediatR;

namespace AuctionServer.Modules.Warehouses.Application.Handlers;

public sealed class WarehouseStockedEventHandler(IWarehouseRepository repository, WarehousesOptions options)
    : INotificationHandler<WarehouseStockedEvent>
{
    public Task Handle(WarehouseStockedEvent notification, CancellationToken cancellationToken)
    {
        return repository.ApplyOnceAsync(notification.EventId, async () =>
        {
            var war = await repository.GetWarByPublicIdAsync(notification.PublicWarehouseId, cancellationToken);
            var totalValue = notification.Stock.Sum(s => s.Price);
            var (estimateMin, estimateMax) = EstimateGenerator.Generate(totalValue, options.EstimateVariants);
            war.OpenLobby(totalValue, estimateMin, estimateMax);

            var stockItems = notification.Stock.Select(s => new StockItem
            {
                PublicWarehouseId = notification.PublicWarehouseId,
                Name = s.Name,
                Rarity = s.Rarity,
                Price = s.Price
            }).ToList();

            repository.AddStock(stockItems);
        }, cancellationToken);
    }
}

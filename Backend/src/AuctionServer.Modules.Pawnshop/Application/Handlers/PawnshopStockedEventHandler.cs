using AuctionServer.Modules.Pawnshop.Application.Interfaces;
using AuctionServer.Modules.Pawnshop.Application.Options;
using AuctionServer.Shared.Integration.Events.Pawnshop;
using MediatR;

namespace AuctionServer.Modules.Pawnshop.Application.Handlers;

public sealed class PawnshopStockedEventHandler(IPawnshopRepository repository, PawnshopOptions options)
    : INotificationHandler<PawnshopStockedEvent>
{
    public Task Handle(PawnshopStockedEvent notification, CancellationToken cancellationToken)
    {
        return repository.ApplyOnceAsync(notification.EventId, async () =>
        {
            var shop = await repository.GetShopByPublicIdAsync(notification.PublicPawnshopId, cancellationToken);
            var items = shop.ReceiveStock(notification.RequestId, notification.Stock, options.StockSellDelay,
                DateTime.UtcNow);

            repository.AddStock(items);
        }, cancellationToken);
    }
}

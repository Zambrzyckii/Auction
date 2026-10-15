using AuctionServer.Modules.Pawnshop.Application.Interfaces;
using AuctionServer.Modules.Pawnshop.Application.Options;
using AuctionServer.Modules.Pawnshop.Domain.Exceptions;
using AuctionServer.Modules.Pawnshop.Infrastructure.Inbox;
using AuctionServer.Shared.Integration.Events.Pawnshop;
using MediatR;

namespace AuctionServer.Modules.Pawnshop.Application.Handlers;

public sealed class PawnshopStockedEventHandler(IPawnshopRepository repository, PawnshopOptions options)
    : INotificationHandler<PawnshopStockedEvent>
{
    public async Task Handle(PawnshopStockedEvent notification, CancellationToken cancellationToken)
    {
        if (await repository.WasEventProcessedAsync(notification.EventId, cancellationToken)) return;

        var shop = await repository.GetShopByPublicIdAsync(notification.PublicPawnshopId, cancellationToken);
        var items = shop.ReceiveStock(notification.RequestId, notification.Stock, options.StockSellDelay,
            DateTime.UtcNow);

        try
        {
            await repository.SaveStockWithInboxAsync(items, new ProcessedMessage { EventId = notification.EventId },
                CancellationToken.None);
        }
        catch (PawnshopExceptions.EventAlreadyProcessedException)
        {
        }
    }
}

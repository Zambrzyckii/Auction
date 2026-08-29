using AuctionServer.Modules.Auctions.Application.Interfaces.Persistence;
using AuctionServer.Modules.Auctions.Domain.Exceptions;
using AuctionServer.Modules.Auctions.Infrastructure.Inbox;
using AuctionServer.Shared.Integration.Events;
using MediatR;

namespace AuctionServer.Modules.Auctions.Application.Handlers;

public sealed class ItemLockRejectedEventHandler(IAuctionRepository repository) : INotificationHandler<ItemLockRejectedEvent>
{
    public async Task Handle(ItemLockRejectedEvent notification, CancellationToken cancellationToken)
    {
        if (await repository.WasEventProcessedAsync(notification.EventId, cancellationToken)) return;

        var auction = await repository.GetAuctionByIdAsync(notification.PublicAuctionId, cancellationToken);
        auction.Cancel(notification.Reason);

        var processedMessage = new ProcessedMessage { EventId = notification.EventId };

        try
        {
            await repository.SaveChangesWithInboxAsync(processedMessage, CancellationToken.None);
        }
        catch (AuctionExceptions.EventAlreadyProcessedException)
        {

        }
    }
}

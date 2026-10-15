using AuctionServer.Modules.Warehouses.Application.Interfaces;
using AuctionServer.Modules.Warehouses.Domain.Exceptions;
using AuctionServer.Modules.Warehouses.Infrastructure.Inbox;
using AuctionServer.Shared.Integration.Events.Warehouses;
using MediatR;

namespace AuctionServer.Modules.Warehouses.Application.Handlers;

public sealed class WarehouseEntryLockRejectedEventHandler(IWarehouseRepository repository)
    : INotificationHandler<WarehouseEntryLockRejectedEvent>
{
    public async Task Handle(WarehouseEntryLockRejectedEvent notification, CancellationToken cancellationToken)
    {
        if (await repository.WasEventProcessedAsync(notification.EventId, cancellationToken)) return;

        var war = await repository.GetWarByPublicIdAsync(notification.PublicWarehouseId, cancellationToken);
        if (war.Participants.Any(p => p.UserId == notification.UserId))
            war.RemoveParticipant(notification.UserId);

        var processedMessage = new ProcessedMessage { EventId = notification.EventId };
        try
        {
            await repository.SaveWarWithInboxAsync(processedMessage, CancellationToken.None);
        }
        catch (WarehouseExceptions.EventAlreadyProcessedException)
        {
        }
    }
}

using System.Text.Json;
using AuctionServer.Modules.Warehouses.Application.Interfaces;
using AuctionServer.Modules.Warehouses.Application.Options;
using AuctionServer.Modules.Warehouses.Domain.Enums;
using AuctionServer.Modules.Warehouses.Domain.Exceptions;
using AuctionServer.Modules.Warehouses.Infrastructure.Inbox;
using AuctionServer.Modules.Warehouses.Infrastructure.Outbox;
using AuctionServer.Shared.Integration.Events;
using MediatR;

namespace AuctionServer.Modules.Warehouses.Application.Handlers;

public sealed class WarehouseEntryLockedEventHandler(IWarehouseRepository repository, WarehousesOptions options)
    : INotificationHandler<WarehouseEntryLockedEvent>
{
    public async Task Handle(WarehouseEntryLockedEvent notification, CancellationToken cancellationToken)
    {
        if (await repository.WasEventProcessedAsync(notification.EventId, cancellationToken)) return;

        var war = await repository.GetWarByPublicIdAsync(notification.PublicWarehouseId, cancellationToken);
        var processedMessage = new ProcessedMessage { EventId = notification.EventId };

        try
        {
            if (war.Status == WarehouseWarStatus.Open && war.Participants.Any(p => p.UserId == notification.UserId))
            {
                war.ConfirmParticipant(notification.UserId, options.MinPlayers, options.MaxPlayers, options.JoinCountdown);
                await repository.SaveWarWithInboxAsync(processedMessage, CancellationToken.None);
                return;
            }
            
            var replyId = Guid.NewGuid();
            var refund = new OutboxMessage
            {
                Id = replyId,
                Type = nameof(FundsUnlockRequestedEvent),
                Content = JsonSerializer.Serialize(new FundsUnlockRequestedEvent(
                    replyId, notification.PublicWarehouseId, notification.UserId))
            };
            await repository.SaveWarWithInboxAndOutboxAsync(processedMessage, refund, CancellationToken.None);
        }
        catch (WarehouseExceptions.EventAlreadyProcessedException)
        {
        }
    }
}

using System.Text.Json;
using AuctionServer.Modules.Warehouses.Application.Interfaces;
using AuctionServer.Modules.Warehouses.Application.Options;
using AuctionServer.Modules.Warehouses.Domain.Enums;
using AuctionServer.Shared.Infrastructure.Outbox;
using AuctionServer.Shared.Integration.Events.Funds;
using AuctionServer.Shared.Integration.Events.Warehouses;
using MediatR;

namespace AuctionServer.Modules.Warehouses.Application.Handlers;

public sealed class WarehouseEntryLockedEventHandler(IWarehouseRepository repository, WarehousesOptions options)
    : INotificationHandler<WarehouseEntryLockedEvent>
{
    public Task Handle(WarehouseEntryLockedEvent notification, CancellationToken cancellationToken)
    {
        return repository.ApplyOnceAsync(notification.EventId, async () =>
        {
            var war = await repository.GetWarByPublicIdAsync(notification.PublicWarehouseId, cancellationToken);

            if (war.Status == WarehouseWarStatus.Open && war.Participants.Any(p =>
                    p.UserId == notification.UserId && p.EntryRequestId == notification.RequestId))
            {
                war.ConfirmParticipant(notification.UserId, options.MinPlayers, options.MaxPlayers, options.JoinCountdown);
                return null;
            }

            var replyId = Guid.NewGuid();
            return new OutboxMessage
            {
                Id = replyId,
                Type = nameof(FundsUnlockRequestedEvent),
                Content = JsonSerializer.Serialize(new FundsUnlockRequestedEvent(
                    replyId, notification.PublicWarehouseId, notification.UserId))
            };
        }, cancellationToken);
    }
}

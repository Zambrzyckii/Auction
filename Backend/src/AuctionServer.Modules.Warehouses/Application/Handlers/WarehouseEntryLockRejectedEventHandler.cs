using AuctionServer.Modules.Warehouses.Application.Interfaces;
using AuctionServer.Shared.Integration.Events.Warehouses;
using MediatR;

namespace AuctionServer.Modules.Warehouses.Application.Handlers;

public sealed class WarehouseEntryLockRejectedEventHandler(IWarehouseRepository repository)
    : INotificationHandler<WarehouseEntryLockRejectedEvent>
{
    public Task Handle(WarehouseEntryLockRejectedEvent notification, CancellationToken cancellationToken)
    {
        return repository.ApplyOnceAsync(notification.EventId, async () =>
        {
            var war = await repository.GetWarByPublicIdAsync(notification.PublicWarehouseId, cancellationToken);
            if (war.Participants.Any(p => p.UserId == notification.UserId && p.EntryRequestId == notification.RequestId))
                war.RemoveParticipant(notification.UserId);
        }, cancellationToken);
    }
}

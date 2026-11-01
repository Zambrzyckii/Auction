using System.Text.Json;
using AuctionServer.Modules.Warehouses.Application.Interfaces;
using AuctionServer.Modules.Warehouses.Application.Options;
using AuctionServer.Shared.Infrastructure.Outbox;
using AuctionServer.Shared.Integration.Events.Warehouses;
using MediatR;

namespace AuctionServer.Modules.Warehouses.Application.Command.JoinWarehouseWar;

public class JoinWarehouseWarCommandHandler(IWarehouseRepository repository, WarehousesOptions options)
    : IRequestHandler<JoinWarehouseWarCommand>
{
    public async Task Handle(JoinWarehouseWarCommand request, CancellationToken token)
    {
        var war = await repository.GetWarByPublicIdAsync(request.PublicWarehouseId, token);
        var eventId = Guid.NewGuid();
        war.Join(request.UserId, options.MaxPlayers, eventId);

        var outboxMessage = new OutboxMessage
        {
            Id = eventId,
            Type = nameof(WarehouseEntryLockRequestedEvent),
            Content = JsonSerializer.Serialize(new WarehouseEntryLockRequestedEvent(
                eventId, request.PublicWarehouseId, request.UserId, war.EntryFee))
        };
        await repository.SaveWarWithOutboxAsync(outboxMessage, token);
    }
}

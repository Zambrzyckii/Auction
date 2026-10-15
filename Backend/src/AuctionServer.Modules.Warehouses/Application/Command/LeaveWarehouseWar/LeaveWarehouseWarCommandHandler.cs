using System.Text.Json;
using AuctionServer.Modules.Warehouses.Application.Interfaces;
using AuctionServer.Modules.Warehouses.Infrastructure.Outbox;
using AuctionServer.Shared.Integration.Events.Funds;
using MediatR;

namespace AuctionServer.Modules.Warehouses.Application.Command.LeaveWarehouseWar;

public class LeaveWarehouseWarCommandHandler(IWarehouseRepository repository)
    : IRequestHandler<LeaveWarehouseWarCommand>
{
    public async Task Handle(LeaveWarehouseWarCommand request, CancellationToken token)
    {
        var war = await repository.GetWarByPublicIdAsync(request.PublicWarehouseId, token);
        war.Leave(request.UserId);

        // The refund is harmless when no lock was confirmed yet: Wallets treats a missing lock as a valid outcome.
        var eventId = Guid.NewGuid();
        var refund = new OutboxMessage
        {
            Id = eventId,
            Type = nameof(FundsUnlockRequestedEvent),
            Content = JsonSerializer.Serialize(new FundsUnlockRequestedEvent(
                eventId, request.PublicWarehouseId, request.UserId))
        };
        await repository.SaveWarWithOutboxAsync(refund, token);
    }
}

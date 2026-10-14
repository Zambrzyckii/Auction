using AuctionServer.Modules.Warehouses.Domain.Enums;

namespace AuctionServer.Modules.Warehouses.Domain.Entities;

public sealed class WarehouseParticipant
{
    public int Id { get; init; }
    public Guid UserId { get; init; }
    public ParticipantState State { get; private set; } = ParticipantState.PendingLock;

    internal void Activate() => State = ParticipantState.Active;
}

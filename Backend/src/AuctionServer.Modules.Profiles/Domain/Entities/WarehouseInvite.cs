namespace AuctionServer.Modules.Profiles.Domain.Entities;

public sealed class WarehouseInvite
{
    public Guid Id { get; init; }
    public Guid InviterId { get; init; }
    public Guid InviteeId { get; init; }
    public Guid PublicWarehouseId { get; init; }
    public DateTime CreatedOn { get; init; }

    public static WarehouseInvite Create(Guid inviterId, Guid inviteeId, Guid publicWarehouseId, DateTime now) =>
        new()
        {
            Id = Guid.NewGuid(),
            InviterId = inviterId,
            InviteeId = inviteeId,
            PublicWarehouseId = publicWarehouseId,
            CreatedOn = now
        };
}

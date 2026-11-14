using MediatR;

namespace AuctionServer.Modules.Profiles.Application.Queries.GetWarehouseInvites;

public record GetWarehouseInvitesQuery(Guid UserId) : IRequest<IReadOnlyList<WarehouseInviteDto>>;

public record WarehouseInviteDto(
    Guid PublicInviteId,
    Guid PublicWarehouseId,
    Guid InviterUserId,
    string InviterUsername,
    DateTime CreatedOn,
    DateTime ExpiresOn);

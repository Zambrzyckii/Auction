using MediatR;

namespace AuctionServer.Modules.Profiles.Application.Queries.GetWarehouseInvites;

public record GetWarehouseInvitesQuery(Guid UserId) : IRequest<IReadOnlyList<WarehouseInviteDto>>;

public record WarehouseInviteDto(Guid PublicWarehouseId, Guid InviterUserId, string InviterUsername, DateTime CreatedOn);

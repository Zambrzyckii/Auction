using AuctionServer.Modules.Profiles.Application.Interfaces;
using AuctionServer.Modules.Profiles.Application.Options;
using MediatR;

namespace AuctionServer.Modules.Profiles.Application.Queries.GetWarehouseInvites;

public sealed class GetWarehouseInvitesQueryHandler(IProfilesRepository repository, ProfilesOptions options)
    : IRequestHandler<GetWarehouseInvitesQuery, IReadOnlyList<WarehouseInviteDto>>
{
    public async Task<IReadOnlyList<WarehouseInviteDto>> Handle(
        GetWarehouseInvitesQuery request, CancellationToken cancellationToken)
    {
        var threshold = DateTime.UtcNow - options.Invites.Lifetime;
        var invites = await repository.GetActiveWarehouseInvitesAsync(request.UserId, threshold, cancellationToken);

        return invites
            .Select(i => new WarehouseInviteDto(i.PublicWarehouseId, i.InviterUserId, i.InviterUsername, i.CreatedOn))
            .ToList();
    }
}

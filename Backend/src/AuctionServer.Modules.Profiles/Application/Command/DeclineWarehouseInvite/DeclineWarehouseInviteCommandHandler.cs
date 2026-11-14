using AuctionServer.Modules.Profiles.Application.Interfaces;
using AuctionServer.Modules.Profiles.Domain.Exceptions;
using MediatR;

namespace AuctionServer.Modules.Profiles.Application.Command.DeclineWarehouseInvite;

public sealed class DeclineWarehouseInviteCommandHandler(IProfilesRepository repository)
    : IRequestHandler<DeclineWarehouseInviteCommand>
{
    public async Task Handle(DeclineWarehouseInviteCommand request, CancellationToken token)
    {
        var invite = await repository.FindWarehouseInviteAsync(request.PublicInviteId, token);

        if (invite is null || invite.InviteeId != request.UserId)
            throw new ProfilesExceptions.WarehouseInviteNotFoundException();

        await repository.RemoveWarehouseInviteAsync(invite, token);
    }
}

using AuctionServer.Modules.Profiles.Application.Interfaces;
using MediatR;

namespace AuctionServer.Modules.Profiles.Application.Command.DeleteAvatar;

public sealed class DeleteAvatarCommandHandler(
    IProfilesRepository repository,
    IAvatarStorage storage) : IRequestHandler<DeleteAvatarCommand>
{
    public async Task Handle(DeleteAvatarCommand request, CancellationToken token)
    {
        var profile = await repository.GetProfileAsync(request.UserId, token);

        await storage.DeleteAsync(request.UserId, token);

        profile.ClearAvatar();
        await repository.SaveChangesAsync(CancellationToken.None);
    }
}

using AuctionServer.Modules.Profiles.Application.Interfaces;
using MediatR;

namespace AuctionServer.Modules.Profiles.Application.Command.SetProfilePrivacy;

public sealed class SetProfilePrivacyCommandHandler(IProfilesRepository repository)
    : IRequestHandler<SetProfilePrivacyCommand>
{
    public async Task Handle(SetProfilePrivacyCommand request, CancellationToken token)
    {
        var profile = await repository.GetProfileAsync(request.UserId, token);

        profile.SetPrivacy(request.IsPrivate);

        await repository.SaveChangesAsync(token);
    }
}

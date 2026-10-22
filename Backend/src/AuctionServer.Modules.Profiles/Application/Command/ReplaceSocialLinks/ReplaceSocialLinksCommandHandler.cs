using AuctionServer.Modules.Profiles.Application.Interfaces;
using MediatR;

namespace AuctionServer.Modules.Profiles.Application.Command.ReplaceSocialLinks;

public sealed class ReplaceSocialLinksCommandHandler(IProfilesRepository repository)
    : IRequestHandler<ReplaceSocialLinksCommand>
{
    public async Task Handle(ReplaceSocialLinksCommand request, CancellationToken token)
    {
        var profile = await repository.GetProfileAsync(request.UserId, token);

        profile.ReplaceSocialLinks(request.Links.Select(l => (l.Platform, l.Url)).ToList());

        await repository.SaveChangesAsync(token);
    }
}

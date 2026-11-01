using AuctionServer.Modules.Profiles.Application.Interfaces;
using AuctionServer.Shared.Integration.Events.Players;
using MediatR;

namespace AuctionServer.Modules.Profiles.Application.Handlers;

public sealed class PlayerLevelledUpEventHandler(IProfilesRepository repository)
    : INotificationHandler<PlayerLevelledUpEvent>
{
    public Task Handle(PlayerLevelledUpEvent notification, CancellationToken cancellationToken)
    {
        return repository.ApplyOnceAsync(notification.EventId, async () =>
        {
            var profile = await repository.GetProfileAsync(notification.UserId, cancellationToken);
            profile.ApplyLevel(notification.NewLevel);
        }, cancellationToken);
    }
}

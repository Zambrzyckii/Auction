using AuctionServer.Modules.Profiles.Application.Interfaces;
using AuctionServer.Modules.Profiles.Domain.Exceptions;
using AuctionServer.Modules.Profiles.Infrastructure.Inbox;
using AuctionServer.Shared.Integration.Events.Players;
using MediatR;

namespace AuctionServer.Modules.Profiles.Application.Handlers;

public sealed class PlayerLevelledUpEventHandler(IProfilesRepository repository)
    : INotificationHandler<PlayerLevelledUpEvent>
{
    public async Task Handle(PlayerLevelledUpEvent notification, CancellationToken cancellationToken)
    {
        if (await repository.WasEventProcessedAsync(notification.EventId, cancellationToken)) return;

        var profile = await repository.GetProfileAsync(notification.UserId, cancellationToken);
        profile.ApplyLevel(notification.NewLevel);

        try
        {
            await repository.SaveChangesWithInboxAsync(new ProcessedMessage { EventId = notification.EventId },
                CancellationToken.None);
        }
        catch (ProfilesExceptions.EventAlreadyProcessedException)
        {
        }
    }
}

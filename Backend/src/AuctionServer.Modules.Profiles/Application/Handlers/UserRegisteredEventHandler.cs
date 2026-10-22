using AuctionServer.Modules.Profiles.Application.Interfaces;
using AuctionServer.Modules.Profiles.Domain.Entities;
using AuctionServer.Modules.Profiles.Domain.Exceptions;
using AuctionServer.Modules.Profiles.Infrastructure.Inbox;
using AuctionServer.Shared.Integration.Events.Users;
using MediatR;

namespace AuctionServer.Modules.Profiles.Application.Handlers;

public sealed class UserRegisteredEventHandler(IProfilesRepository repository)
    : INotificationHandler<UserRegisteredEvent>
{
    public async Task Handle(UserRegisteredEvent notification, CancellationToken cancellationToken)
    {
        if (await repository.WasEventProcessedAsync(notification.EventId, cancellationToken)) return;

        var username = string.IsNullOrWhiteSpace(notification.Username) ? "Player" : notification.Username;
        var profile = UserProfile.Create(notification.PublicUserId, username, DateTime.UtcNow);

        try
        {
            await repository.AddProfileWithInboxAsync(profile, new ProcessedMessage { EventId = notification.EventId },
                CancellationToken.None);
        }
        catch (ProfilesExceptions.EventAlreadyProcessedException)
        {
        }
    }
}

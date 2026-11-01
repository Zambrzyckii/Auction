using AuctionServer.Modules.Profiles.Application.Interfaces;
using AuctionServer.Modules.Profiles.Domain.Entities;
using AuctionServer.Shared.Integration.Events.Users;
using MediatR;

namespace AuctionServer.Modules.Profiles.Application.Handlers;

public sealed class UserRegisteredEventHandler(IProfilesRepository repository)
    : INotificationHandler<UserRegisteredEvent>
{
    public Task Handle(UserRegisteredEvent notification, CancellationToken cancellationToken)
    {
        return repository.ApplyOnceAsync(notification.EventId, () =>
        {
            var username = string.IsNullOrWhiteSpace(notification.Username) ? "Player" : notification.Username;
            var profile = UserProfile.Create(notification.PublicUserId, username, DateTime.UtcNow);

            repository.AddProfile(profile);
            return Task.CompletedTask;
        }, cancellationToken);
    }
}

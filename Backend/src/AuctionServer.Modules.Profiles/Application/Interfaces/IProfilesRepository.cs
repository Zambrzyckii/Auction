using AuctionServer.Modules.Profiles.Domain.Entities;
using AuctionServer.Modules.Profiles.Infrastructure.Inbox;

namespace AuctionServer.Modules.Profiles.Application.Interfaces;

public interface IProfilesRepository
{
    Task<UserProfile> GetProfileAsync(Guid userId, CancellationToken token);
    Task<UserProfile?> FindProfileReadOnlyAsync(Guid userId, CancellationToken token);
    Task<bool> WasEventProcessedAsync(Guid eventId, CancellationToken token);
    Task AddProfileWithInboxAsync(UserProfile profile, ProcessedMessage message, CancellationToken token);
    Task SaveChangesWithInboxAsync(ProcessedMessage message, CancellationToken token);
}

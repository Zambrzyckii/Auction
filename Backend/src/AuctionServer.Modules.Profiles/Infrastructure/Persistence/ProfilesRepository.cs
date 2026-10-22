using AuctionServer.Modules.Profiles.Application.Interfaces;
using AuctionServer.Modules.Profiles.Domain.Entities;
using AuctionServer.Modules.Profiles.Domain.Exceptions;
using AuctionServer.Modules.Profiles.Infrastructure.Inbox;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace AuctionServer.Modules.Profiles.Infrastructure.Persistence;

public sealed class ProfilesRepository(ProfilesDbContext context) : IProfilesRepository
{
    public async Task<UserProfile> GetProfileAsync(Guid userId, CancellationToken token)
    {
        var profile = await context.UserProfiles.SingleOrDefaultAsync(p => p.UserId == userId, token);

        if (profile is null) throw new ProfilesExceptions.ProfileNotFoundException();

        return profile;
    }

    public async Task<UserProfile?> FindProfileReadOnlyAsync(Guid userId, CancellationToken token) =>
        await context.UserProfiles.AsNoTracking().SingleOrDefaultAsync(p => p.UserId == userId, token);

    public async Task<bool> WasEventProcessedAsync(Guid eventId, CancellationToken token) =>
        await context.ProcessedMessages.Where(m => m.EventId == eventId).AnyAsync(token);

    public async Task AddProfileWithInboxAsync(UserProfile profile, ProcessedMessage message, CancellationToken token)
    {
        context.UserProfiles.Add(profile);
        context.ProcessedMessages.Add(message);
        await SaveTranslatingUniqueViolationAsync(token);
    }

    public async Task SaveChangesAsync(CancellationToken token) =>
        await context.SaveChangesAsync(token);

    public async Task SaveChangesWithInboxAsync(ProcessedMessage message, CancellationToken token)
    {
        context.ProcessedMessages.Add(message);
        await SaveTranslatingUniqueViolationAsync(token);
    }

    private async Task SaveTranslatingUniqueViolationAsync(CancellationToken token)
    {
        try
        {
            await context.SaveChangesAsync(token);
        }
        catch (DbUpdateException e) when (e.InnerException is PostgresException
                                          {
                                              SqlState: PostgresErrorCodes.UniqueViolation
                                          })
        {
            throw new ProfilesExceptions.EventAlreadyProcessedException();
        }
    }
}

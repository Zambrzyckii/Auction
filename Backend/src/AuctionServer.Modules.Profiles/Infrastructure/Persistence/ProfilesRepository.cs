using AuctionServer.Modules.Profiles.Application.Interfaces;
using AuctionServer.Modules.Profiles.Domain.Entities;
using AuctionServer.Modules.Profiles.Domain.Enums;
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

    public async Task<Friendship?> FindFriendshipAsync(Guid userLowId, Guid userHighId, CancellationToken token) =>
        await context.Friendships.SingleOrDefaultAsync(
            f => f.UserLowId == userLowId && f.UserHighId == userHighId, token);

    public async Task<int> CountAcceptedFriendshipsAsync(Guid userId, CancellationToken token) =>
        await context.Friendships.CountAsync(f =>
            f.Status == FriendshipStatus.Accepted
            && (f.RequesterId == userId || f.AddresseeId == userId), token);

    public async Task AddFriendshipAsync(Friendship friendship, CancellationToken token)
    {
        context.Friendships.Add(friendship);
        try
        {
            await context.SaveChangesAsync(token);
        }
        catch (DbUpdateException e) when (e.InnerException is PostgresException
                                          {
                                              SqlState: PostgresErrorCodes.UniqueViolation
                                          })
        {
            throw new ProfilesExceptions.FriendshipAlreadyExistsException();
        }
    }

    public async Task<Friendship> GetFriendshipAsync(Guid publicFriendshipId, CancellationToken token) =>
        await context.Friendships.SingleOrDefaultAsync(f => f.PublicFriendshipId == publicFriendshipId, token)
        ?? throw new ProfilesExceptions.FriendRequestNotFoundException();

    public async Task RemoveFriendshipAsync(Friendship friendship, CancellationToken token)
    {
        context.Friendships.Remove(friendship);
        await context.SaveChangesAsync(token);
    }

    public async Task RemoveFriendshipWithPairInvitesAsync(Friendship friendship, CancellationToken token)
    {
        var pairInvites = await context.WarehouseInvites
            .Where(i => (i.InviterId == friendship.RequesterId && i.InviteeId == friendship.AddresseeId)
                        || (i.InviterId == friendship.AddresseeId && i.InviteeId == friendship.RequesterId))
            .ToListAsync(token);
        context.WarehouseInvites.RemoveRange(pairInvites);
        context.Friendships.Remove(friendship);
        await context.SaveChangesAsync(token);
    }

    public async Task<List<FriendEntry>> GetAcceptedFriendsAsync(Guid userId, CancellationToken token) =>
        await context.Friendships
            .Where(f => f.Status == FriendshipStatus.Accepted
                        && (f.RequesterId == userId || f.AddresseeId == userId))
            .Select(f => f.RequesterId == userId ? f.AddresseeId : f.RequesterId)
            .Join(context.UserProfiles,
                friendId => friendId,
                p => p.UserId,
                (friendId, p) => new { p.UserId, p.Username })
            .OrderBy(x => x.Username)
            .Select(x => new FriendEntry(x.UserId, x.Username))
            .ToListAsync(token);

    public async Task<List<PendingFriendEntry>> GetPendingFriendshipsAsync(Guid userId, CancellationToken token) =>
        await context.Friendships
            .Where(f => f.Status == FriendshipStatus.Pending
                        && (f.RequesterId == userId || f.AddresseeId == userId))
            .Select(f => new
            {
                f.PublicFriendshipId,
                Incoming = f.AddresseeId == userId,
                OtherId = f.RequesterId == userId ? f.AddresseeId : f.RequesterId
            })
            .Join(context.UserProfiles,
                x => x.OtherId,
                p => p.UserId,
                (x, p) => new PendingFriendEntry(x.PublicFriendshipId, p.UserId, p.Username, x.Incoming))
            .ToListAsync(token);

    public async Task<List<WarehouseInviteEntry>> GetActiveWarehouseInvitesAsync(
        Guid inviteeId, DateTime threshold, CancellationToken token) =>
        await context.WarehouseInvites
            .Where(i => i.InviteeId == inviteeId && i.CreatedOn >= threshold)
            .Join(context.UserProfiles,
                i => i.InviterId,
                p => p.UserId,
                (i, p) => new { i.PublicWarehouseId, p.UserId, p.Username, i.CreatedOn })
            .OrderByDescending(x => x.CreatedOn)
            .Select(x => new WarehouseInviteEntry(x.PublicWarehouseId, x.UserId, x.Username, x.CreatedOn))
            .ToListAsync(token);

    public async Task<int> PurgeExpiredWarehouseInvitesAsync(DateTime threshold, CancellationToken token) =>
        await context.WarehouseInvites
            .Where(i => i.CreatedOn < threshold)
            .ExecuteDeleteAsync(token);

    public async Task AddWarehouseInviteAsync(WarehouseInvite invite, CancellationToken token)
    {
        context.WarehouseInvites.Add(invite);
        try
        {
            await context.SaveChangesAsync(token);
        }
        catch (DbUpdateException e) when (e.InnerException is PostgresException
                                          {
                                              SqlState: PostgresErrorCodes.UniqueViolation
                                          })
        {
            throw new ProfilesExceptions.DuplicateWarehouseInviteException();
        }
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

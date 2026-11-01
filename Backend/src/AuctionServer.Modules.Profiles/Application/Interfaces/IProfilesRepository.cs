using AuctionServer.Modules.Profiles.Domain.Entities;

namespace AuctionServer.Modules.Profiles.Application.Interfaces;

public interface IProfilesRepository
{
    Task<UserProfile> GetProfileAsync(Guid userId, CancellationToken token);
    Task<UserProfile?> FindProfileReadOnlyAsync(Guid userId, CancellationToken token);
    Task ApplyOnceAsync(Guid eventId, Func<Task> change, CancellationToken token);
    void AddProfile(UserProfile profile);
    Task SaveChangesAsync(CancellationToken token);
    Task<Friendship?> FindFriendshipAsync(Guid userLowId, Guid userHighId, CancellationToken token);
    Task<Friendship> GetFriendshipAsync(Guid publicFriendshipId, CancellationToken token);
    Task<int> CountAcceptedFriendshipsAsync(Guid userId, CancellationToken token);
    Task AddFriendshipAsync(Friendship friendship, CancellationToken token);
    Task RemoveFriendshipAsync(Friendship friendship, CancellationToken token);
    Task RemoveFriendshipWithPairInvitesAsync(Friendship friendship, CancellationToken token);
    Task<List<FriendEntry>> GetAcceptedFriendsAsync(Guid userId, CancellationToken token);
    Task<List<PendingFriendEntry>> GetPendingFriendshipsAsync(Guid userId, CancellationToken token);
    Task<List<WarehouseInviteEntry>> GetActiveWarehouseInvitesAsync(Guid inviteeId, DateTime threshold, CancellationToken token);
    Task<int> PurgeExpiredWarehouseInvitesAsync(DateTime threshold, CancellationToken token);
    Task AddWarehouseInviteAsync(WarehouseInvite invite, CancellationToken token);
}

public sealed record FriendEntry(Guid UserId, string Username);

public sealed record PendingFriendEntry(Guid PublicFriendshipId, Guid UserId, string Username, bool Incoming);

public sealed record WarehouseInviteEntry(Guid PublicWarehouseId, Guid InviterUserId, string InviterUsername, DateTime CreatedOn);

using AuctionServer.Modules.Identity.Application.Interfaces;
using AuctionServer.Modules.Identity.Domain.Entities;

namespace AuctionServer.Modules.Identity.Tests.Application;

public sealed class FakeRefreshTokenRepository : IRefreshTokenRepository
{
    public List<RefreshToken> Stored { get; } = [];
    public List<RefreshToken> Added { get; } = [];
    public User? User { get; set; }
    public List<Guid> RevokedFamilies { get; } = [];
    public int SaveCount { get; private set; }
    public DateTime? PurgedAt { get; private set; }

    public Task<RefreshToken?> GetByHashAsync(string tokenHash, CancellationToken token) =>
        Task.FromResult(Stored.SingleOrDefault(t => t.TokenHash == tokenHash));

    public Task<User?> GetUserAsync(int userId, CancellationToken token) =>
        Task.FromResult(User is { IsDeleted: false } && User.Id == userId ? User : null);

    public void Add(RefreshToken refreshToken) => Added.Add(refreshToken);

    public Task RemoveDeadAsync(int userId, DateTime now, CancellationToken token)
    {
        PurgedAt = now;
        return Task.CompletedTask;
    }

    public Task RevokeFamilyAsync(Guid familyId, DateTime now, CancellationToken token)
    {
        RevokedFamilies.Add(familyId);
        foreach (var stored in Stored.Where(t => t.FamilyId == familyId)) stored.Revoke(now);
        return Task.CompletedTask;
    }

    public Task SaveChangesAsync(CancellationToken token)
    {
        SaveCount++;
        Stored.AddRange(Added.Where(t => !Stored.Contains(t)));
        return Task.CompletedTask;
    }
}

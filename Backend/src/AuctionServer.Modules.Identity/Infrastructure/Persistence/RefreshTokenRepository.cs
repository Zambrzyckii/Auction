using AuctionServer.Modules.Identity.Application.Interfaces;
using AuctionServer.Modules.Identity.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace AuctionServer.Modules.Identity.Infrastructure.Persistence;

public class RefreshTokenRepository(IdentityDbContext context) : IRefreshTokenRepository
{
    public async Task<RefreshToken?> GetByHashAsync(string tokenHash, CancellationToken token)
    {
        return await context.RefreshTokens.SingleOrDefaultAsync(t => t.TokenHash == tokenHash, token);
    }

    public async Task<User?> GetUserAsync(int userId, CancellationToken token)
    {
        return await context.Users.SingleOrDefaultAsync(u => u.Id == userId, token);
    }

    public void Add(RefreshToken refreshToken) => context.RefreshTokens.Add(refreshToken);

    public async Task RemoveDeadAsync(int userId, DateTime now, CancellationToken token)
    {
        var deadlineDate = now - RefreshToken.Lifetime;
        var dead = await context.RefreshTokens
            .Where(t => 
                t.CreatedOn < deadlineDate 
                && t.UserId == userId 
                && (t.RevokedOn != null || t.ExpiresOn <= now))
            .ToListAsync(token);
        context.RefreshTokens.RemoveRange(dead);
    }

    public async Task RevokeFamilyAsync(Guid familyId, DateTime now, CancellationToken token)
    {
        await context.RefreshTokens
            .Where(t => t.FamilyId == familyId && t.RevokedOn == null)
            .ExecuteUpdateAsync(s => s
                .SetProperty(t => t.RevokedOn, now)
                .SetProperty(t => t.Version, Guid.NewGuid()), token);
    }

    public async Task SaveChangesAsync(CancellationToken token) => await context.SaveChangesAsync(token);
}

using AuctionServer.Modules.Identity.Domain.Entities;

namespace AuctionServer.Modules.Identity.Application.Interfaces;

public interface IRefreshTokenRepository
{
    Task<RefreshToken?> GetByHashAsync(string tokenHash, CancellationToken token);
    Task<User?> GetUserAsync(int userId, CancellationToken token);
    void Add(RefreshToken refreshToken);
    Task RemoveDeadAsync(int userId, DateTime now, CancellationToken token);
    Task RevokeFamilyAsync(Guid familyId, DateTime now, CancellationToken token);
    Task SaveChangesAsync(CancellationToken token);
}

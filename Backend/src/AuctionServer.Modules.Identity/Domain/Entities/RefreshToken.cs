namespace AuctionServer.Modules.Identity.Domain.Entities;

public sealed class RefreshToken
{
    public static readonly TimeSpan Lifetime = TimeSpan.FromDays(7);

    public Guid Id { get; init; }
    public int UserId { get; init; }
    public string TokenHash { get; init; } = null!;
    public Guid FamilyId { get; init; }
    public DateTime CreatedOn { get; init; }
    public DateTime ExpiresOn { get; init; }
    public DateTime? RevokedOn { get; private set; }
    public Guid Version { get; private set; }

    public static RefreshToken Issue(int userId, Guid familyId, string tokenHash, DateTime now) =>
        new()
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            TokenHash = tokenHash,
            FamilyId = familyId,
            CreatedOn = now,
            ExpiresOn = now + Lifetime,
            Version = Guid.NewGuid()
        };

    public bool IsActive(DateTime now) => RevokedOn is null && now < ExpiresOn;

    public void Revoke(DateTime now)
    {
        if (RevokedOn is not null) return;
        RevokedOn = now;
        Version = Guid.NewGuid();
    }
}

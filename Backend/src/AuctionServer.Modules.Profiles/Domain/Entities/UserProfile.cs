namespace AuctionServer.Modules.Profiles.Domain.Entities;

public sealed class UserProfile
{
    public Guid UserId { get; init; }
    public string Username { get; private set; } = null!;
    public int Level { get; private set; }
    public DateTime CreatedOn { get; private set; }
    public Guid Version { get; private set; } = Guid.NewGuid();

    public static UserProfile Create(Guid userId, string username, DateTime now) =>
        new() { UserId = userId, Username = username, CreatedOn = now };

    public void ApplyLevel(int newLevel)
    {
        if (newLevel <= Level) return;
        Level = newLevel;
        Version = Guid.NewGuid();
    }
}

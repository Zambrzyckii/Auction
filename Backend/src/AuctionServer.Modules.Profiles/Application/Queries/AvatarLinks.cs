namespace AuctionServer.Modules.Profiles.Application.Queries;

public static class AvatarLinks
{
    public static string? For(Guid userId, string? avatarHash) =>
        avatarHash is null ? null : $"/api/profiles/{userId}/avatar?v={avatarHash[..12]}";
}

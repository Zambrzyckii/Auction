using AuctionServer.Modules.Profiles.Domain.Enums;

namespace AuctionServer.Modules.Profiles.Domain.Entities;

public sealed class SocialLink
{
    public SocialPlatform Platform { get; init; }
    public string Url { get; private set; } = null!;

    internal static SocialLink Create(SocialPlatform platform, string url) =>
        new() { Platform = platform, Url = url };

    internal void Update(string url) => Url = url;
}

using AuctionServer.Modules.Profiles.Domain.Enums;
using AuctionServer.Modules.Profiles.Domain.Exceptions;

namespace AuctionServer.Modules.Profiles.Domain.Entities;

public sealed class UserProfile
{
    public Guid UserId { get; init; }
    public string Username { get; private set; } = null!;
    public int Level { get; private set; }
    public DateTime CreatedOn { get; private set; }
    public string? AvatarContentType { get; private set; }
    public string? AvatarHash { get; private set; }
    public DateTime? AvatarUpdatedOn { get; private set; }
    public Guid Version { get; private set; } = Guid.NewGuid();
    private readonly List<SocialLink> _socialLinks = [];

    public IReadOnlyCollection<SocialLink> SocialLinks => _socialLinks;

    public static UserProfile Create(Guid userId, string username, DateTime now) =>
        new() { UserId = userId, Username = username, CreatedOn = now };

    public void ApplyLevel(int newLevel)
    {
        if (newLevel <= Level) return;
        Level = newLevel;
        Version = Guid.NewGuid();
    }

    public void SetAvatar(string contentType, string hash, DateTime now)
    {
        AvatarContentType = contentType;
        AvatarHash = hash;
        AvatarUpdatedOn = now;
        Version = Guid.NewGuid();
    }

    public void ClearAvatar()
    {
        AvatarContentType = null;
        AvatarHash = null;
        AvatarUpdatedOn = null;
        Version = Guid.NewGuid();
    }

    public void ReplaceSocialLinks(IReadOnlyList<(SocialPlatform Platform, string Url)> links)
    {
        if (links.Count > SocialLinkPolicy.MaxLinks)
            throw new ProfilesExceptions.InvalidSocialLinkException(
                $"A profile can carry at most {SocialLinkPolicy.MaxLinks} social links");
        if (links.Select(l => l.Platform).Distinct().Count() != links.Count)
            throw new ProfilesExceptions.InvalidSocialLinkException("Each platform can be linked once");
        foreach (var (platform, url) in links) SocialLinkPolicy.Validate(platform, url);

        _socialLinks.RemoveAll(existing => links.All(l => l.Platform != existing.Platform));
        
        foreach (var (platform, url) in links)
        {
            var existing = _socialLinks.FirstOrDefault(x => x.Platform == platform);
            
            if (existing is null) _socialLinks.Add(SocialLink.Create(platform, url));
            else existing.Update(url);
        }

        Version = Guid.NewGuid();
    }
}

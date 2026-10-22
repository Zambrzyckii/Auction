using AuctionServer.Modules.Profiles.Domain.Enums;

namespace AuctionServer.Modules.Profiles.Application.Queries.GetProfile;

public record ProfileDto(
    Guid UserId,
    string Username,
    int Level,
    DateTime MemberSince,
    string? AvatarUrl,
    IReadOnlyList<SocialLinkDto> SocialLinks);

public record SocialLinkDto(SocialPlatform Platform, string Url);

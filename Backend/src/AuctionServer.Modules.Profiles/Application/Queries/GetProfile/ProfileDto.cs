using AuctionServer.Modules.Profiles.Domain.Enums;

namespace AuctionServer.Modules.Profiles.Application.Queries.GetProfile;

public record ProfileDto(
    Guid UserId,
    string Username,
    int Level,
    DateTime MemberSince,
    string? AvatarUrl,
    IReadOnlyList<FriendDto> Friends,
    IReadOnlyList<SocialLinkDto> SocialLinks);

public record FriendDto(Guid UserId, string Username);

public record SocialLinkDto(SocialPlatform Platform, string Url);

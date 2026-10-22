using AuctionServer.Modules.Profiles.Domain.Enums;

namespace AuctionServer.Modules.Profiles.Application.Queries.GetOwnProfile;

public record OwnProfileDto(
    Guid UserId,
    string Username,
    bool IsPrivate,
    int Level,
    DateTime MemberSince,
    string? AvatarUrl,
    IReadOnlyList<FriendDto> Friends,
    IReadOnlyList<PendingFriendRequestDto> IncomingFriendRequests,
    IReadOnlyList<PendingFriendRequestDto> OutgoingFriendRequests,
    IReadOnlyList<SocialLinkDto> SocialLinks);

public record FriendDto(Guid UserId, string Username);

public record PendingFriendRequestDto(Guid PublicFriendshipId, Guid UserId, string Username);

public record SocialLinkDto(SocialPlatform Platform, string Url);

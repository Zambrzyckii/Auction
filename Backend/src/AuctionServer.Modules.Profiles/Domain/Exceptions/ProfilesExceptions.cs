using AuctionServer.Shared.Integration.Exceptions;

namespace AuctionServer.Modules.Profiles.Domain.Exceptions;

public static class ProfilesExceptions
{
    public sealed class ProfileNotFoundException()
        : AppException("Profile was not found", 404);

    public sealed class EventAlreadyProcessedException()
        : AppException("Event was already processed", 409);

    public sealed class InvalidSocialLinkException(string message)
        : AppException(message, 400);

    public sealed class InvalidAvatarException(string message)
        : AppException(message, 400);

    public sealed class AvatarNotFoundException()
        : AppException("Avatar was not found", 404);

    public sealed class AvatarStorageUnavailableException()
        : AppException("Avatar storage is unavailable", 503);

    public sealed class InvalidFriendRequestException(string message)
        : AppException(message, 400);

    public sealed class FriendRequestNotFoundException()
        : AppException("Friend request was not found", 404);

    public sealed class FriendshipAlreadyExistsException()
        : AppException("Friendship or a pending request already exists", 409);

    public sealed class FriendshipNotFoundException()
        : AppException("Friendship was not found", 404);

    public sealed class NotFriendsException()
        : AppException("Players are not friends", 409);

    public sealed class FriendLimitReachedException()
        : AppException($"A player can have at most {Entities.Friendship.MaxFriends} friends", 409);

    public sealed class DuplicateWarehouseInviteException()
        : AppException("Invite for this warehouse already exists", 409);
}

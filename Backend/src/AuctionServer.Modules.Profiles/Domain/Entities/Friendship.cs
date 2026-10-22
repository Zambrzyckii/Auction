using AuctionServer.Modules.Profiles.Domain.Enums;
using AuctionServer.Modules.Profiles.Domain.Exceptions;

namespace AuctionServer.Modules.Profiles.Domain.Entities;

public sealed class Friendship
{
    public const int MaxFriends = 100;

    public Guid PublicFriendshipId { get; init; }
    public Guid RequesterId { get; private set; }
    public Guid AddresseeId { get; private set; }
    public Guid UserLowId { get; private set; }
    public Guid UserHighId { get; private set; }
    public FriendshipStatus Status { get; private set; }
    public DateTime CreatedOn { get; private set; }

    public static Friendship Create(Guid requesterId, Guid addresseeId, DateTime now)
    {
        if (requesterId == addresseeId)
            throw new ProfilesExceptions.InvalidFriendRequestException("You cannot befriend yourself");

        var (low, high) = FriendshipPair.Normalize(requesterId, addresseeId);
        return new Friendship
        {
            PublicFriendshipId = Guid.NewGuid(),
            RequesterId = requesterId,
            AddresseeId = addresseeId,
            UserLowId = low,
            UserHighId = high,
            Status = FriendshipStatus.Pending,
            CreatedOn = now
        };
    }

    public void Accept(Guid callerId)
    {
        if (callerId != AddresseeId)
            throw new ProfilesExceptions.FriendRequestNotFoundException();
        Status = FriendshipStatus.Accepted;
    }

    public bool Involves(Guid userId) => RequesterId == userId || AddresseeId == userId;

    public Guid OtherThan(Guid userId) => RequesterId == userId ? AddresseeId : RequesterId;
}

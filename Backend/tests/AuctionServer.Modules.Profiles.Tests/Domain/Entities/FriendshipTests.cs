using AuctionServer.Modules.Profiles.Domain;
using AuctionServer.Modules.Profiles.Domain.Entities;
using AuctionServer.Modules.Profiles.Domain.Enums;
using AuctionServer.Modules.Profiles.Domain.Exceptions;

namespace AuctionServer.Modules.Profiles.Tests.Domain.Entities;

public class FriendshipTests
{
    [Fact]
    public void Create_ShouldStartPendingWithNormalizedPair()
    {
        var requesterId = Guid.NewGuid();
        var addresseeId = Guid.NewGuid();

        var friendship = Friendship.Create(requesterId, addresseeId, DateTime.UtcNow);

        Assert.Equal(FriendshipStatus.Pending, friendship.Status);
        Assert.Equal(requesterId, friendship.RequesterId);
        Assert.Equal(addresseeId, friendship.AddresseeId);
        Assert.NotEqual(Guid.Empty, friendship.PublicFriendshipId);
        Assert.Equal(FriendshipPair.Normalize(requesterId, addresseeId),
            (friendship.UserLowId, friendship.UserHighId));
    }

    [Fact]
    public void Create_WithSelfAsAddressee_ShouldThrowBadRequest()
    {
        var userId = Guid.NewGuid();

        Assert.Throws<ProfilesExceptions.InvalidFriendRequestException>(() =>
            Friendship.Create(userId, userId, DateTime.UtcNow));
    }

    [Fact]
    public void Accept_ByAddressee_ShouldMarkAccepted()
    {
        var friendship = Friendship.Create(Guid.NewGuid(), Guid.NewGuid(), DateTime.UtcNow);

        friendship.Accept(friendship.AddresseeId);

        Assert.Equal(FriendshipStatus.Accepted, friendship.Status);
    }

    [Fact]
    public void Accept_ByRequester_ShouldThrowNotFoundWithoutLeakingExistence()
    {
        var friendship = Friendship.Create(Guid.NewGuid(), Guid.NewGuid(), DateTime.UtcNow);

        Assert.Throws<ProfilesExceptions.FriendRequestNotFoundException>(() =>
            friendship.Accept(friendship.RequesterId));
        Assert.Equal(FriendshipStatus.Pending, friendship.Status);
    }

    [Fact]
    public void Accept_ByStranger_ShouldThrowNotFound()
    {
        var friendship = Friendship.Create(Guid.NewGuid(), Guid.NewGuid(), DateTime.UtcNow);

        Assert.Throws<ProfilesExceptions.FriendRequestNotFoundException>(() =>
            friendship.Accept(Guid.NewGuid()));
    }

    [Fact]
    public void OtherThan_ShouldReturnTheOtherSide()
    {
        var requesterId = Guid.NewGuid();
        var addresseeId = Guid.NewGuid();
        var friendship = Friendship.Create(requesterId, addresseeId, DateTime.UtcNow);

        Assert.Equal(addresseeId, friendship.OtherThan(requesterId));
        Assert.Equal(requesterId, friendship.OtherThan(addresseeId));
    }
}

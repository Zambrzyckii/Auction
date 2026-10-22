using AuctionServer.Modules.Profiles.Application.Command.AcceptFriendRequest;
using AuctionServer.Modules.Profiles.Application.Command.DeclineFriendRequest;
using AuctionServer.Modules.Profiles.Application.Command.RemoveFriend;
using AuctionServer.Modules.Profiles.Application.Command.RequestFriendship;
using AuctionServer.Modules.Profiles.Application.Queries.GetOwnProfile;
using AuctionServer.Modules.Profiles.Domain.Entities;
using AuctionServer.Modules.Profiles.Domain.Enums;
using AuctionServer.Modules.Profiles.Domain.Exceptions;
using AuctionServer.Modules.Profiles.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace AuctionServer.Modules.Profiles.Tests.IntegrationTests;

[Collection(ProfilesIntegrationCollection.Name)]
public class FriendshipCommandHandlerTests(ProfilesPostgresFixture fixture)
{
    private async Task<FriendRequestDto> RequestAsync(Guid callerId, Guid targetId)
    {
        await using var context = fixture.CreateContext();
        var handler = new RequestFriendshipCommandHandler(new ProfilesRepository(context));
        return await handler.Handle(new RequestFriendshipCommand(callerId, targetId), CancellationToken.None);
    }

    private async Task AcceptAsync(Guid callerId, Guid publicFriendshipId)
    {
        await using var context = fixture.CreateContext();
        var handler = new AcceptFriendRequestCommandHandler(new ProfilesRepository(context));
        await handler.Handle(new AcceptFriendRequestCommand(callerId, publicFriendshipId), CancellationToken.None);
    }

    private async Task DeclineAsync(Guid callerId, Guid publicFriendshipId)
    {
        await using var context = fixture.CreateContext();
        var handler = new DeclineFriendRequestCommandHandler(new ProfilesRepository(context));
        await handler.Handle(new DeclineFriendRequestCommand(callerId, publicFriendshipId), CancellationToken.None);
    }

    private async Task RemoveAsync(Guid callerId, Guid otherId)
    {
        await using var context = fixture.CreateContext();
        var handler = new RemoveFriendCommandHandler(new ProfilesRepository(context));
        await handler.Handle(new RemoveFriendCommand(callerId, otherId), CancellationToken.None);
    }

    private async Task<OwnProfileDto> GetOwnAsync(Guid userId)
    {
        await using var context = fixture.CreateContext();
        var handler = new GetOwnProfileQueryHandler(new ProfilesRepository(context));
        return await handler.Handle(new GetOwnProfileQuery(userId), CancellationToken.None);
    }

    [Fact]
    public async Task Request_ShouldCreatePendingVisibleOnBothSides()
    {
        var requesterId = await fixture.SeedProfileAsync("requester");
        var addresseeId = await fixture.SeedProfileAsync("addressee");

        var dto = await RequestAsync(requesterId, addresseeId);

        Assert.Equal(FriendshipStatus.Pending, dto.Status);
        var outgoing = Assert.Single((await GetOwnAsync(requesterId)).OutgoingFriendRequests);
        Assert.Equal(addresseeId, outgoing.UserId);
        var incoming = Assert.Single((await GetOwnAsync(addresseeId)).IncomingFriendRequests);
        Assert.Equal(requesterId, incoming.UserId);
        Assert.Equal(dto.PublicFriendshipId, incoming.PublicFriendshipId);
    }

    [Fact]
    public async Task Request_CrossRequest_ShouldAutoAcceptTheExistingOne()
    {
        var firstId = await fixture.SeedProfileAsync("first");
        var secondId = await fixture.SeedProfileAsync("second");
        var first = await RequestAsync(firstId, secondId);

        var second = await RequestAsync(secondId, firstId);

        Assert.Equal(first.PublicFriendshipId, second.PublicFriendshipId);
        Assert.Equal(FriendshipStatus.Accepted, second.Status);
        var profile = await GetOwnAsync(firstId);
        var friend = Assert.Single(profile.Friends);
        Assert.Equal(secondId, friend.UserId);
        Assert.Empty(profile.OutgoingFriendRequests);
    }

    [Fact]
    public async Task Request_Duplicate_ShouldThrowConflict()
    {
        var requesterId = await fixture.SeedProfileAsync();
        var addresseeId = await fixture.SeedProfileAsync();
        await RequestAsync(requesterId, addresseeId);

        await Assert.ThrowsAsync<ProfilesExceptions.FriendshipAlreadyExistsException>(() =>
            RequestAsync(requesterId, addresseeId));
    }

    [Fact]
    public async Task Request_ToUnknownPlayer_ShouldThrowNotFound()
    {
        var requesterId = await fixture.SeedProfileAsync();

        await Assert.ThrowsAsync<ProfilesExceptions.ProfileNotFoundException>(() =>
            RequestAsync(requesterId, Guid.NewGuid()));
    }

    [Fact]
    public async Task Request_ToSelf_ShouldThrowBadRequest()
    {
        var userId = await fixture.SeedProfileAsync();

        await Assert.ThrowsAsync<ProfilesExceptions.InvalidFriendRequestException>(() =>
            RequestAsync(userId, userId));
    }

    [Fact]
    public async Task Accept_ByAddressee_ShouldShowFriendOnBothProfiles()
    {
        var requesterId = await fixture.SeedProfileAsync("req-player");
        var addresseeId = await fixture.SeedProfileAsync("addr-player");
        var dto = await RequestAsync(requesterId, addresseeId);

        await AcceptAsync(addresseeId, dto.PublicFriendshipId);

        var requesterProfile = await GetOwnAsync(requesterId);
        Assert.Equal(addresseeId, Assert.Single(requesterProfile.Friends).UserId);
        Assert.Empty(requesterProfile.OutgoingFriendRequests);
        var addresseeProfile = await GetOwnAsync(addresseeId);
        Assert.Equal(requesterId, Assert.Single(addresseeProfile.Friends).UserId);
        Assert.Empty(addresseeProfile.IncomingFriendRequests);
    }

    [Fact]
    public async Task Accept_ByRequester_ShouldThrowNotFound()
    {
        var requesterId = await fixture.SeedProfileAsync();
        var addresseeId = await fixture.SeedProfileAsync();
        var dto = await RequestAsync(requesterId, addresseeId);

        await Assert.ThrowsAsync<ProfilesExceptions.FriendRequestNotFoundException>(() =>
            AcceptAsync(requesterId, dto.PublicFriendshipId));
    }

    [Fact]
    public async Task Decline_ShouldDeleteRowAndAllowNewRequest()
    {
        var requesterId = await fixture.SeedProfileAsync();
        var addresseeId = await fixture.SeedProfileAsync();
        var first = await RequestAsync(requesterId, addresseeId);

        await DeclineAsync(addresseeId, first.PublicFriendshipId);

        Assert.Empty((await GetOwnAsync(addresseeId)).IncomingFriendRequests);
        var second = await RequestAsync(requesterId, addresseeId);
        Assert.NotEqual(first.PublicFriendshipId, second.PublicFriendshipId);
    }

    [Fact]
    public async Task Remove_ShouldDeleteFriendshipAndPairInvites()
    {
        var firstId = await fixture.SeedProfileAsync();
        var secondId = await fixture.SeedProfileAsync();
        var dto = await RequestAsync(firstId, secondId);
        await AcceptAsync(secondId, dto.PublicFriendshipId);
        await using (var seedContext = fixture.CreateContext())
        {
            seedContext.WarehouseInvites.Add(WarehouseInvite.Create(firstId, secondId, Guid.NewGuid(), DateTime.UtcNow));
            seedContext.WarehouseInvites.Add(WarehouseInvite.Create(secondId, firstId, Guid.NewGuid(), DateTime.UtcNow));
            await seedContext.SaveChangesAsync();
        }

        await RemoveAsync(firstId, secondId);

        await using var context = fixture.CreateContext();
        Assert.False(await context.Friendships.AnyAsync(f => f.RequesterId == firstId || f.AddresseeId == firstId));
        Assert.False(await context.WarehouseInvites.AnyAsync(i => i.InviterId == firstId || i.InviteeId == firstId));
        Assert.Empty((await GetOwnAsync(firstId)).Friends);
    }

    [Fact]
    public async Task Request_WhenCallerIsAtFriendCap_ShouldThrowLimit()
    {
        var callerId = await fixture.SeedProfileAsync();
        var targetId = await fixture.SeedProfileAsync();
        await using (var seedContext = fixture.CreateContext())
        {
            for (var i = 0; i < Friendship.MaxFriends; i++)
            {
                var otherId = Guid.NewGuid();
                var friendship = Friendship.Create(callerId, otherId, DateTime.UtcNow);
                friendship.Accept(otherId);
                seedContext.Friendships.Add(friendship);
            }
            await seedContext.SaveChangesAsync();
        }

        await Assert.ThrowsAsync<ProfilesExceptions.FriendLimitReachedException>(() =>
            RequestAsync(callerId, targetId));
    }
}

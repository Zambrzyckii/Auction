using AuctionServer.Modules.Profiles.Application.Command.AcceptFriendRequest;
using AuctionServer.Modules.Profiles.Application.Command.RequestFriendship;
using AuctionServer.Modules.Profiles.Application.Command.SetProfilePrivacy;
using AuctionServer.Modules.Profiles.Application.Queries.GetOwnProfile;
using AuctionServer.Modules.Profiles.Application.Queries.GetProfile;
using AuctionServer.Modules.Profiles.Domain.Exceptions;
using AuctionServer.Modules.Profiles.Infrastructure.Persistence;

namespace AuctionServer.Modules.Profiles.Tests.IntegrationTests;

[Collection(ProfilesIntegrationCollection.Name)]
public class ProfilePrivacyHandlerTests(ProfilesPostgresFixture fixture)
{
    private const string AvatarHash = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

    private async Task SetPrivacyAsync(Guid userId, bool isPrivate)
    {
        await using var context = fixture.CreateContext();
        var handler = new SetProfilePrivacyCommandHandler(new ProfilesRepository(context));
        await handler.Handle(new SetProfilePrivacyCommand(userId, isPrivate), CancellationToken.None);
    }

    private async Task<ProfileDto> GetProfileAsync(Guid publicUserId, Guid viewerId)
    {
        await using var context = fixture.CreateContext();
        var handler = new GetProfileQueryHandler(new ProfilesRepository(context));
        return await handler.Handle(new GetProfileQuery(publicUserId, viewerId), CancellationToken.None);
    }

    private async Task SeedAvatarAsync(Guid userId)
    {
        await using var context = fixture.CreateContext();
        var profile = await context.UserProfiles.FindAsync(userId);
        profile!.SetAvatar("image/png", AvatarHash, DateTime.UtcNow);
        await context.SaveChangesAsync();
    }

    [Fact]
    public async Task SetPrivacy_ShouldPersistFlag()
    {
        var userId = await fixture.SeedProfileAsync("privacy-toggler");

        await SetPrivacyAsync(userId, true);

        await using var context = fixture.CreateContext();
        var handler = new GetOwnProfileQueryHandler(new ProfilesRepository(context));
        var dto = await handler.Handle(new GetOwnProfileQuery(userId), CancellationToken.None);
        Assert.True(dto.IsPrivate);
    }

    [Fact]
    public async Task SetPrivacy_WhenProfileIsMissing_ShouldThrowNotFound()
    {
        await using var context = fixture.CreateContext();
        var handler = new SetProfilePrivacyCommandHandler(new ProfilesRepository(context));

        await Assert.ThrowsAsync<ProfilesExceptions.ProfileNotFoundException>(() =>
            handler.Handle(new SetProfilePrivacyCommand(Guid.NewGuid(), true), CancellationToken.None));
    }

    [Fact]
    public async Task GetProfile_WhenPrivateViewedByStranger_ShouldHideEverythingButUsernameAndAvatar()
    {
        var ownerId = await fixture.SeedProfileAsync("private-owner");
        await SeedAvatarAsync(ownerId);
        await SetPrivacyAsync(ownerId, true);

        var dto = await GetProfileAsync(ownerId, Guid.NewGuid());

        Assert.True(dto.IsPrivate);
        Assert.Equal("private-owner", dto.Username);
        Assert.NotNull(dto.AvatarUrl);
        Assert.Null(dto.Level);
        Assert.Null(dto.MemberSince);
        Assert.Empty(dto.Friends);
        Assert.Empty(dto.SocialLinks);
    }

    [Fact]
    public async Task GetProfile_WhenPrivateViewedByFriend_ShouldReturnFullProfile()
    {
        var ownerId = await fixture.SeedProfileAsync("private-befriended");
        var friendId = await fixture.SeedProfileAsync("trusted-friend");
        await SetPrivacyAsync(ownerId, true);

        await using (var context = fixture.CreateContext())
        {
            var request = new RequestFriendshipCommandHandler(new ProfilesRepository(context));
            var pending = await request.Handle(
                new RequestFriendshipCommand(friendId, ownerId), CancellationToken.None);
            var accept = new AcceptFriendRequestCommandHandler(new ProfilesRepository(context));
            await accept.Handle(
                new AcceptFriendRequestCommand(ownerId, pending.PublicFriendshipId), CancellationToken.None);
        }

        var dto = await GetProfileAsync(ownerId, friendId);

        Assert.True(dto.IsPrivate);
        Assert.NotNull(dto.Level);
        Assert.NotNull(dto.MemberSince);
        Assert.Single(dto.Friends);
    }

    [Fact]
    public async Task GetProfile_WhenPrivateViewedByOwner_ShouldReturnFullProfile()
    {
        var ownerId = await fixture.SeedProfileAsync("private-self-viewer");
        await SetPrivacyAsync(ownerId, true);

        var dto = await GetProfileAsync(ownerId, ownerId);

        Assert.True(dto.IsPrivate);
        Assert.NotNull(dto.Level);
        Assert.NotNull(dto.MemberSince);
    }

    [Fact]
    public async Task GetProfile_WhenPrivacyIsTurnedOff_ShouldReturnFullProfileAgain()
    {
        var ownerId = await fixture.SeedProfileAsync("privacy-reverter");
        await SetPrivacyAsync(ownerId, true);
        await SetPrivacyAsync(ownerId, false);

        var dto = await GetProfileAsync(ownerId, Guid.NewGuid());

        Assert.False(dto.IsPrivate);
        Assert.NotNull(dto.Level);
        Assert.NotNull(dto.MemberSince);
    }
}

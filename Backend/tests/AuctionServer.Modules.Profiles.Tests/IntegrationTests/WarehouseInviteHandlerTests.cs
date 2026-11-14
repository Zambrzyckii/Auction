using AuctionServer.Modules.Profiles.Application.Command.CreateWarehouseInvite;
using AuctionServer.Modules.Profiles.Application.Command.DeclineWarehouseInvite;
using AuctionServer.Modules.Profiles.Application.Options;
using AuctionServer.Modules.Profiles.Application.Queries.GetWarehouseInvites;
using AuctionServer.Modules.Profiles.Domain.Entities;
using AuctionServer.Modules.Profiles.Domain.Exceptions;
using AuctionServer.Modules.Profiles.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace AuctionServer.Modules.Profiles.Tests.IntegrationTests;

[Collection(ProfilesIntegrationCollection.Name)]
public class WarehouseInviteHandlerTests(ProfilesPostgresFixture fixture)
{
    private static ProfilesOptions TestOptions() => new(
        new AvatarOptions(1024),
        new InviteOptions(TimeSpan.FromMinutes(15)),
        new StorageOptions("http://localhost:8333", "avatars", true));

    private async Task<Guid> CreateInviteAsync(Guid callerId, Guid friendId, Guid warehouseId)
    {
        await using var context = fixture.CreateContext();
        var handler = new CreateWarehouseInviteCommandHandler(new ProfilesRepository(context), TestOptions());
        return await handler.Handle(new CreateWarehouseInviteCommand(callerId, friendId, warehouseId), CancellationToken.None);
    }

    private async Task DeclineAsync(Guid callerId, Guid publicInviteId)
    {
        await using var context = fixture.CreateContext();
        var handler = new DeclineWarehouseInviteCommandHandler(new ProfilesRepository(context));
        await handler.Handle(new DeclineWarehouseInviteCommand(callerId, publicInviteId), CancellationToken.None);
    }

    private async Task<IReadOnlyList<WarehouseInviteDto>> GetInvitesAsync(Guid userId)
    {
        await using var context = fixture.CreateContext();
        var handler = new GetWarehouseInvitesQueryHandler(new ProfilesRepository(context), TestOptions());
        return await handler.Handle(new GetWarehouseInvitesQuery(userId), CancellationToken.None);
    }

    private async Task<(Guid InviterId, Guid InviteeId)> SeedFriendsAsync()
    {
        var inviterId = await fixture.SeedProfileAsync("war-inviter");
        var inviteeId = await fixture.SeedProfileAsync("war-invitee");
        await using var context = fixture.CreateContext();
        var friendship = Friendship.Create(inviterId, inviteeId, DateTime.UtcNow);
        friendship.Accept(inviteeId);
        context.Friendships.Add(friendship);
        await context.SaveChangesAsync();
        return (inviterId, inviteeId);
    }

    [Fact]
    public async Task Create_ShouldAppearOnInviteeListWithInviterUsername()
    {
        var (inviterId, inviteeId) = await SeedFriendsAsync();
        var warehouseId = Guid.NewGuid();

        await CreateInviteAsync(inviterId, inviteeId, warehouseId);

        var invite = Assert.Single(await GetInvitesAsync(inviteeId));
        Assert.Equal(warehouseId, invite.PublicWarehouseId);
        Assert.Equal(inviterId, invite.InviterUserId);
        Assert.Equal("war-inviter", invite.InviterUsername);
        Assert.Empty(await GetInvitesAsync(inviterId));
    }

    [Fact]
    public async Task Create_ShouldReturnIdExposedWithExpiryOnTheList()
    {
        var (inviterId, inviteeId) = await SeedFriendsAsync();

        var publicInviteId = await CreateInviteAsync(inviterId, inviteeId, Guid.NewGuid());

        var invite = Assert.Single(await GetInvitesAsync(inviteeId));
        Assert.Equal(publicInviteId, invite.PublicInviteId);
        Assert.Equal(invite.CreatedOn + TimeSpan.FromMinutes(15), invite.ExpiresOn);
    }

    [Fact]
    public async Task Create_WithoutFriendship_ShouldThrowConflict()
    {
        var inviterId = await fixture.SeedProfileAsync();
        var strangerId = await fixture.SeedProfileAsync();

        await Assert.ThrowsAsync<ProfilesExceptions.NotFriendsException>(() =>
            CreateInviteAsync(inviterId, strangerId, Guid.NewGuid()));
    }

    [Fact]
    public async Task Create_WithPendingFriendship_ShouldThrowConflict()
    {
        var inviterId = await fixture.SeedProfileAsync();
        var pendingId = await fixture.SeedProfileAsync();
        await using (var context = fixture.CreateContext())
        {
            context.Friendships.Add(Friendship.Create(inviterId, pendingId, DateTime.UtcNow));
            await context.SaveChangesAsync();
        }

        await Assert.ThrowsAsync<ProfilesExceptions.NotFriendsException>(() =>
            CreateInviteAsync(inviterId, pendingId, Guid.NewGuid()));
    }

    [Fact]
    public async Task Create_Duplicate_ShouldThrowConflict()
    {
        var (inviterId, inviteeId) = await SeedFriendsAsync();
        var warehouseId = Guid.NewGuid();
        await CreateInviteAsync(inviterId, inviteeId, warehouseId);

        await Assert.ThrowsAsync<ProfilesExceptions.DuplicateWarehouseInviteException>(() =>
            CreateInviteAsync(inviterId, inviteeId, warehouseId));
    }

    [Fact]
    public async Task ExpiredInvite_ShouldBeInvisibleAndPurgeAllowsReinvite()
    {
        var (inviterId, inviteeId) = await SeedFriendsAsync();
        var warehouseId = Guid.NewGuid();
        await using (var context = fixture.CreateContext())
        {
            context.WarehouseInvites.Add(
                WarehouseInvite.Create(inviterId, inviteeId, warehouseId, DateTime.UtcNow.AddHours(-1)));
            await context.SaveChangesAsync();
        }

        Assert.Empty(await GetInvitesAsync(inviteeId));

        await CreateInviteAsync(inviterId, inviteeId, warehouseId);

        var invite = Assert.Single(await GetInvitesAsync(inviteeId));
        Assert.Equal(warehouseId, invite.PublicWarehouseId);
    }

    [Fact]
    public async Task Decline_ByInvitee_ShouldRemoveTheInvite()
    {
        var (inviterId, inviteeId) = await SeedFriendsAsync();
        var publicInviteId = await CreateInviteAsync(inviterId, inviteeId, Guid.NewGuid());

        await DeclineAsync(inviteeId, publicInviteId);

        Assert.Empty(await GetInvitesAsync(inviteeId));
        await using var context = fixture.CreateContext();
        Assert.False(await context.WarehouseInvites.AnyAsync(i => i.Id == publicInviteId));
    }

    [Fact]
    public async Task Decline_ByInviter_ShouldThrowNotFoundAndKeepTheInvite()
    {
        var (inviterId, inviteeId) = await SeedFriendsAsync();
        var publicInviteId = await CreateInviteAsync(inviterId, inviteeId, Guid.NewGuid());

        await Assert.ThrowsAsync<ProfilesExceptions.WarehouseInviteNotFoundException>(() =>
            DeclineAsync(inviterId, publicInviteId));

        Assert.Single(await GetInvitesAsync(inviteeId));
    }

    [Fact]
    public async Task Decline_ByStranger_ShouldThrowNotFound()
    {
        var (inviterId, inviteeId) = await SeedFriendsAsync();
        var strangerId = await fixture.SeedProfileAsync();
        var publicInviteId = await CreateInviteAsync(inviterId, inviteeId, Guid.NewGuid());

        await Assert.ThrowsAsync<ProfilesExceptions.WarehouseInviteNotFoundException>(() =>
            DeclineAsync(strangerId, publicInviteId));
    }

    [Fact]
    public async Task Decline_UnknownId_ShouldThrowNotFound()
    {
        var inviteeId = await fixture.SeedProfileAsync();

        await Assert.ThrowsAsync<ProfilesExceptions.WarehouseInviteNotFoundException>(() =>
            DeclineAsync(inviteeId, Guid.NewGuid()));
    }

    [Fact]
    public async Task Decline_ThenReinvite_ShouldCreateAFreshInvite()
    {
        var (inviterId, inviteeId) = await SeedFriendsAsync();
        var warehouseId = Guid.NewGuid();
        var first = await CreateInviteAsync(inviterId, inviteeId, warehouseId);
        await DeclineAsync(inviteeId, first);

        var second = await CreateInviteAsync(inviterId, inviteeId, warehouseId);

        Assert.NotEqual(first, second);
        var invite = Assert.Single(await GetInvitesAsync(inviteeId));
        Assert.Equal(second, invite.PublicInviteId);
    }
}

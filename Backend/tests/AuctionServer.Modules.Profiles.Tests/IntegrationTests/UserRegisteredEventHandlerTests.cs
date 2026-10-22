using AuctionServer.Modules.Profiles.Application.Handlers;
using AuctionServer.Modules.Profiles.Infrastructure.Persistence;
using AuctionServer.Shared.Integration.Events.Users;
using Microsoft.EntityFrameworkCore;

namespace AuctionServer.Modules.Profiles.Tests.IntegrationTests;

[Collection(ProfilesIntegrationCollection.Name)]
public class UserRegisteredEventHandlerTests(ProfilesPostgresFixture fixture)
{
    private async Task HandleAsync(UserRegisteredEvent notification)
    {
        await using var context = fixture.CreateContext();
        var handler = new UserRegisteredEventHandler(new ProfilesRepository(context));
        await handler.Handle(notification, CancellationToken.None);
    }

    [Fact]
    public async Task Handle_ShouldCreateProfileWithUsernameAndInboxRow()
    {
        var notification = new UserRegisteredEvent(Guid.NewGuid(), Guid.NewGuid(), "new@player.test", "new-player");

        await HandleAsync(notification);

        var profile = await fixture.GetProfileAsync(notification.PublicUserId);
        Assert.Equal("new-player", profile.Username);
        Assert.Equal(0, profile.Level);

        await using var context = fixture.CreateContext();
        Assert.True(await context.ProcessedMessages.AnyAsync(m => m.EventId == notification.EventId));
    }

    [Fact]
    public async Task Handle_WhenUsernameIsMissing_ShouldFallBackToPlayer()
    {
        var notification = new UserRegisteredEvent(Guid.NewGuid(), Guid.NewGuid(), "legacy@player.test");

        await HandleAsync(notification);

        var profile = await fixture.GetProfileAsync(notification.PublicUserId);
        Assert.Equal("Player", profile.Username);
    }

    [Fact]
    public async Task Handle_WhenDeliveredTwice_ShouldCreateOneProfile()
    {
        var notification = new UserRegisteredEvent(Guid.NewGuid(), Guid.NewGuid(), "twice@player.test", "twice");

        await HandleAsync(notification);
        await HandleAsync(notification);

        await using var context = fixture.CreateContext();
        Assert.Equal(1, await context.UserProfiles.CountAsync(p => p.UserId == notification.PublicUserId));
    }

    [Fact]
    public async Task Handle_WhenProfileAlreadyExists_ShouldSwallowAndKeepTheFirst()
    {
        var userId = Guid.NewGuid();
        await HandleAsync(new UserRegisteredEvent(Guid.NewGuid(), userId, "first@player.test", "first"));

        await HandleAsync(new UserRegisteredEvent(Guid.NewGuid(), userId, "second@player.test", "second"));

        var profile = await fixture.GetProfileAsync(userId);
        Assert.Equal("first", profile.Username);
    }
}

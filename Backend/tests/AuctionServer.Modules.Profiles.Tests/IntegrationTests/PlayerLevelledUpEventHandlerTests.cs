using AuctionServer.Modules.Profiles.Application.Handlers;
using AuctionServer.Modules.Profiles.Domain.Exceptions;
using AuctionServer.Modules.Profiles.Infrastructure.Persistence;
using AuctionServer.Shared.Integration.Events.Players;
using Microsoft.EntityFrameworkCore;

namespace AuctionServer.Modules.Profiles.Tests.IntegrationTests;

[Collection(ProfilesIntegrationCollection.Name)]
public class PlayerLevelledUpEventHandlerTests(ProfilesPostgresFixture fixture)
{
    private async Task HandleAsync(PlayerLevelledUpEvent notification)
    {
        await using var context = fixture.CreateContext();
        var handler = new PlayerLevelledUpEventHandler(new ProfilesRepository(context));
        await handler.Handle(notification, CancellationToken.None);
    }

    [Fact]
    public async Task Handle_ShouldRaiseLevelAndStoreInboxRow()
    {
        var userId = await fixture.SeedProfileAsync();
        var notification = new PlayerLevelledUpEvent(Guid.NewGuid(), userId, 0, 3, 140m);

        await HandleAsync(notification);

        var profile = await fixture.GetProfileAsync(userId);
        Assert.Equal(3, profile.Level);

        await using var context = fixture.CreateContext();
        Assert.True(await context.ProcessedMessages.AnyAsync(m => m.EventId == notification.EventId));
    }

    [Fact]
    public async Task Handle_WhenEventArrivesOutOfOrder_ShouldKeepTheHigherLevel()
    {
        var userId = await fixture.SeedProfileAsync();
        await HandleAsync(new PlayerLevelledUpEvent(Guid.NewGuid(), userId, 3, 5, 410m));

        await HandleAsync(new PlayerLevelledUpEvent(Guid.NewGuid(), userId, 0, 3, 140m));

        var profile = await fixture.GetProfileAsync(userId);
        Assert.Equal(5, profile.Level);
    }

    [Fact]
    public async Task Handle_WhenProfileIsMissing_ShouldThrowNotFound()
    {
        var notification = new PlayerLevelledUpEvent(Guid.NewGuid(), Guid.NewGuid(), 0, 1, 10m);

        await Assert.ThrowsAsync<ProfilesExceptions.ProfileNotFoundException>(() => HandleAsync(notification));
    }

    [Fact]
    public async Task Handle_WhenDeliveredTwice_ShouldStoreOneInboxRow()
    {
        var userId = await fixture.SeedProfileAsync();
        var notification = new PlayerLevelledUpEvent(Guid.NewGuid(), userId, 0, 2, 50m);

        await HandleAsync(notification);
        await HandleAsync(notification);

        var profile = await fixture.GetProfileAsync(userId);
        Assert.Equal(2, profile.Level);

        await using var context = fixture.CreateContext();
        Assert.Equal(1, await context.ProcessedMessages.CountAsync(m => m.EventId == notification.EventId));
    }
}

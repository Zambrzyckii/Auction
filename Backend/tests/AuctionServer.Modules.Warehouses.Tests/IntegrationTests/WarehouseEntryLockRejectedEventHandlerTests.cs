using AuctionServer.Modules.Warehouses.Application.Handlers;
using AuctionServer.Modules.Warehouses.Infrastructure.Persistence;
using AuctionServer.Shared.Integration.Events;
using Microsoft.EntityFrameworkCore;

namespace AuctionServer.Modules.Warehouses.Tests.IntegrationTests;

[Collection(WarehousesIntegrationCollection.Name)]
public class WarehouseEntryLockRejectedEventHandlerTests(WarehousesPostgresFixture fixture)
{
    private async Task HandleAsync(WarehouseEntryLockRejectedEvent notification)
    {
        await using var context = fixture.CreateContext();
        var handler = new WarehouseEntryLockRejectedEventHandler(new WarehouseRepository(context));
        await handler.Handle(notification, CancellationToken.None);
    }

    [Fact]
    public async Task Handle_ShouldRemovePendingParticipant()
    {
        var userId = Guid.NewGuid();
        var seeded = await fixture.SeedOpenWarAsync(userId);
        var notification = new WarehouseEntryLockRejectedEvent(
            Guid.NewGuid(), seeded.PublicWarehouseId, userId, "Not enough funds on account");

        await HandleAsync(notification);

        var war = await fixture.GetWarAsync(seeded.PublicWarehouseId);
        Assert.Empty(war.Participants);

        await using var context = fixture.CreateContext();
        Assert.True(await context.ProcessedMessages.AnyAsync(m => m.EventId == notification.EventId));
    }

    [Fact]
    public async Task Handle_WhenParticipantAlreadyGone_ShouldOnlyWriteInbox()
    {
        var seeded = await fixture.SeedOpenWarAsync();
        var notification = new WarehouseEntryLockRejectedEvent(
            Guid.NewGuid(), seeded.PublicWarehouseId, Guid.NewGuid(), "Not enough funds on account");

        await HandleAsync(notification);

        await using var context = fixture.CreateContext();
        Assert.True(await context.ProcessedMessages.AnyAsync(m => m.EventId == notification.EventId));
    }

    [Fact]
    public async Task Handle_WhenEventIsDeliveredTwice_ShouldNotThrow()
    {
        var userId = Guid.NewGuid();
        var seeded = await fixture.SeedOpenWarAsync(userId);
        var notification = new WarehouseEntryLockRejectedEvent(
            Guid.NewGuid(), seeded.PublicWarehouseId, userId, "Not enough funds on account");

        await HandleAsync(notification);
        await HandleAsync(notification);

        var war = await fixture.GetWarAsync(seeded.PublicWarehouseId);
        Assert.Empty(war.Participants);
    }
}

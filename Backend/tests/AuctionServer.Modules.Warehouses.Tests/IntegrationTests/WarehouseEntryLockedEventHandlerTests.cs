using AuctionServer.Modules.Warehouses.Application.Handlers;
using AuctionServer.Modules.Warehouses.Application.Options;
using AuctionServer.Modules.Warehouses.Domain.Enums;
using AuctionServer.Modules.Warehouses.Infrastructure.Persistence;
using AuctionServer.Shared.Integration.Events;
using Microsoft.EntityFrameworkCore;

namespace AuctionServer.Modules.Warehouses.Tests.IntegrationTests;

[Collection(WarehousesIntegrationCollection.Name)]
public class WarehouseEntryLockedEventHandlerTests(WarehousesPostgresFixture fixture)
{
    private static readonly WarehousesOptions Options = new(
        PoolSize: 3, MinPlayers: 3, MaxPlayers: 5,
        JoinCountdown: TimeSpan.FromSeconds(30), RaiseWindow: TimeSpan.FromSeconds(10), LobbyTimeout: TimeSpan.FromMinutes(10),
        Tiers: [new WarehouseTierDefinition("Small", 3, 5, 500m, [10m, 50m], [new RarityWeight("Common", 1)])],
        EstimateVariants: [new EstimateVariant(Weight: 1, MinMultiplier: 0.5m, MaxMultiplier: 1.0m)]);

    private async Task HandleAsync(WarehouseEntryLockedEvent notification)
    {
        await using var context = fixture.CreateContext();
        var handler = new WarehouseEntryLockedEventHandler(new WarehouseRepository(context), Options);
        await handler.Handle(notification, CancellationToken.None);
    }

    private async Task<int> CountRefundsAsync(Guid warehouseId)
    {
        await using var context = fixture.CreateContext();
        return await context.OutboxMessages
            .CountAsync(m => m.Type == nameof(FundsUnlockRequestedEvent) && m.Content.Contains(warehouseId.ToString()));
    }

    [Fact]
    public async Task Handle_WhenWarIsOpen_ShouldActivateParticipant()
    {
        var userId = Guid.NewGuid();
        var seeded = await fixture.SeedOpenWarAsync(userId);
        var notification = new WarehouseEntryLockedEvent(Guid.NewGuid(), seeded.PublicWarehouseId, userId);

        await HandleAsync(notification);

        var war = await fixture.GetWarAsync(seeded.PublicWarehouseId);
        var participant = Assert.Single(war.Participants);
        Assert.Equal(ParticipantState.Active, participant.State);
        Assert.Equal(0, await CountRefundsAsync(seeded.PublicWarehouseId));

        await using var context = fixture.CreateContext();
        Assert.True(await context.ProcessedMessages.AnyAsync(m => m.EventId == notification.EventId));
    }

    [Fact]
    public async Task Handle_WhenWarIsNotOpen_ShouldRefundEntryFee()
    {
        var seeded = await fixture.SeedWarAsync();
        var notification = new WarehouseEntryLockedEvent(Guid.NewGuid(), seeded.PublicWarehouseId, Guid.NewGuid());

        await HandleAsync(notification);

        var war = await fixture.GetWarAsync(seeded.PublicWarehouseId);
        Assert.Empty(war.Participants);
        Assert.Equal(1, await CountRefundsAsync(seeded.PublicWarehouseId));

        await using var context = fixture.CreateContext();
        Assert.True(await context.ProcessedMessages.AnyAsync(m => m.EventId == notification.EventId));
    }

    [Fact]
    public async Task Handle_WhenParticipantLeftBeforeConfirmation_ShouldRefundEntryFee()
    {
        var seeded = await fixture.SeedOpenWarAsync();
        var notification = new WarehouseEntryLockedEvent(Guid.NewGuid(), seeded.PublicWarehouseId, Guid.NewGuid());

        await HandleAsync(notification);

        Assert.Equal(1, await CountRefundsAsync(seeded.PublicWarehouseId));
    }

    [Fact]
    public async Task Handle_WhenEventIsDeliveredTwice_ShouldStoreSingleRefund()
    {
        var seeded = await fixture.SeedOpenWarAsync();
        var notification = new WarehouseEntryLockedEvent(Guid.NewGuid(), seeded.PublicWarehouseId, Guid.NewGuid());

        await HandleAsync(notification);
        await HandleAsync(notification);

        Assert.Equal(1, await CountRefundsAsync(seeded.PublicWarehouseId));
    }
}

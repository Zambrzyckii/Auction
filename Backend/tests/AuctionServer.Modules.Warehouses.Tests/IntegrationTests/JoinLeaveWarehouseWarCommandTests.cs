using AuctionServer.Modules.Warehouses.Application.Command.JoinWarehouseWar;
using AuctionServer.Modules.Warehouses.Application.Command.LeaveWarehouseWar;
using AuctionServer.Modules.Warehouses.Application.Options;
using AuctionServer.Modules.Warehouses.Domain.Enums;
using AuctionServer.Modules.Warehouses.Domain.Exceptions;
using AuctionServer.Modules.Warehouses.Infrastructure.Persistence;
using AuctionServer.Shared.Integration.Events.Funds;
using AuctionServer.Shared.Integration.Events.Warehouses;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;

namespace AuctionServer.Modules.Warehouses.Tests.IntegrationTests;

[Collection(WarehousesIntegrationCollection.Name)]
public class JoinLeaveWarehouseWarCommandTests(WarehousesPostgresFixture fixture)
{
    private static readonly WarehousesOptions Options = new(
        PoolSize: 3, MinPlayers: 3, MaxPlayers: 2,
        JoinCountdown: TimeSpan.FromSeconds(30), RaiseWindow: TimeSpan.FromSeconds(10), LobbyTimeout: TimeSpan.FromMinutes(10),
        Tiers: [new WarehouseTierDefinition("Small", 3, 5, 500m, [10m, 50m], [new RarityWeight("Common", 1)])],
        EstimateVariants: [new EstimateVariant(Weight: 1, MinMultiplier: 0.5m, MaxMultiplier: 1.0m)]);

    private async Task JoinAsync(Guid warehouseId, Guid userId)
    {
        await using var context = fixture.CreateContext();
        var handler = new JoinWarehouseWarCommandHandler(new WarehouseRepository(context), Options);
        await handler.Handle(new JoinWarehouseWarCommand(warehouseId, userId), CancellationToken.None);
    }

    private async Task LeaveAsync(Guid warehouseId, Guid userId)
    {
        await using var context = fixture.CreateContext();
        var handler = new LeaveWarehouseWarCommandHandler(new WarehouseRepository(context));
        await handler.Handle(new LeaveWarehouseWarCommand(warehouseId, userId), CancellationToken.None);
    }

    [Fact]
    public async Task Join_ShouldAddPendingParticipantAndRequestEntryLock()
    {
        var seeded = await fixture.SeedOpenWarAsync();
        var userId = Guid.NewGuid();

        await JoinAsync(seeded.PublicWarehouseId, userId);

        var war = await fixture.GetWarAsync(seeded.PublicWarehouseId);
        var participant = Assert.Single(war.Participants);
        Assert.Equal(ParticipantState.PendingLock, participant.State);

        await using var context = fixture.CreateContext();
        var outboxMessage = await context.OutboxMessages.SingleAsync(m =>
            m.Type == nameof(WarehouseEntryLockRequestedEvent) && m.Content.Contains(userId.ToString()));
        var lockRequest = JsonSerializer.Deserialize<WarehouseEntryLockRequestedEvent>(outboxMessage.Content);
        Assert.NotNull(lockRequest);
        Assert.Equal(outboxMessage.Id, lockRequest.EventId);
        Assert.Equal(500m, lockRequest.Amount);
    }

    [Fact]
    public async Task Join_WhenLobbyIsFull_ShouldThrowWithoutOutboxRow()
    {
        var seeded = await fixture.SeedOpenWarAsync(Guid.NewGuid(), Guid.NewGuid());
        var userId = Guid.NewGuid();

        await Assert.ThrowsAsync<WarehouseExceptions.WarehouseFullException>(
            () => JoinAsync(seeded.PublicWarehouseId, userId));

        await using var context = fixture.CreateContext();
        Assert.False(await context.OutboxMessages.AnyAsync(m => m.Content.Contains(userId.ToString())));
    }

    [Fact]
    public async Task Leave_ShouldRemoveParticipantAndRequestRefund()
    {
        var userId = Guid.NewGuid();
        var seeded = await fixture.SeedOpenWarAsync(userId);

        await LeaveAsync(seeded.PublicWarehouseId, userId);

        var war = await fixture.GetWarAsync(seeded.PublicWarehouseId);
        Assert.Empty(war.Participants);

        await using var context = fixture.CreateContext();
        Assert.True(await context.OutboxMessages.AnyAsync(m =>
            m.Type == nameof(FundsUnlockRequestedEvent) && m.Content.Contains(userId.ToString())));
    }

    [Fact]
    public async Task Leave_WhenNotParticipant_ShouldThrow()
    {
        var seeded = await fixture.SeedOpenWarAsync();

        await Assert.ThrowsAsync<WarehouseExceptions.ParticipantNotFoundException>(
            () => LeaveAsync(seeded.PublicWarehouseId, Guid.NewGuid()));
    }
}

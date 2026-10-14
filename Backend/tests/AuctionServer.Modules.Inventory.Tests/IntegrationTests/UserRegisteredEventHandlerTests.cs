using AuctionServer.Modules.Inventory.Application.Options;
using AuctionServer.Modules.Inventory.Application.Handlers;
using AuctionServer.Modules.Inventory.Domain.Entities;
using AuctionServer.Modules.Inventory.Domain.Enums;
using AuctionServer.Modules.Inventory.Infrastructure.Persistence;
using AuctionServer.Shared.Integration.Events;
using Microsoft.EntityFrameworkCore;

namespace AuctionServer.Modules.Inventory.Tests.IntegrationTests;

[Collection(InventoryIntegrationCollection.Name)]
public class UserRegisteredEventHandlerTests(InventoryPostgresFixture fixture)
{
    private static readonly InventoryOptions DefaultPack = new([
        new StarterItemDefinition("Rusty Toolbox", ItemRarity.Common),
        new StarterItemDefinition("Old Radio", ItemRarity.Common),
        new StarterItemDefinition("Worn Backpack", ItemRarity.Common)
    ]);

    private static UserRegisteredEvent CreateEvent(Guid userId) => new(Guid.NewGuid(), userId, "player@example.com");

    private async Task HandleAsync(UserRegisteredEvent notification, InventoryOptions? options = null)
    {
        await using var context = fixture.CreateContext();
        var handler = new UserRegisteredEventHandler(new ItemRepository(context), options ?? DefaultPack);
        await handler.Handle(notification, CancellationToken.None);
    }

    private async Task<List<Item>> GetUserItemsAsync(Guid userId)
    {
        await using var context = fixture.CreateContext();
        return await context.Items.AsNoTracking().Where(i => i.OwnerUserId == userId).ToListAsync();
    }

    private async Task<bool> WasProcessedAsync(Guid eventId)
    {
        await using var context = fixture.CreateContext();
        return await context.ProcessedMessages.AnyAsync(m => m.EventId == eventId);
    }

    [Fact]
    public async Task Handle_WhenUserRegisters_ShouldGrantConfiguredStarterPack()
    {
        var userId = Guid.NewGuid();
        var notification = CreateEvent(userId);

        await HandleAsync(notification);

        var items = await GetUserItemsAsync(userId);
        Assert.Equal(3, items.Count);
        Assert.All(items, i => Assert.Equal(ItemRarity.Common, i.Rarity));
        Assert.All(items, i => Assert.Equal(ItemStatus.Available, i.Status));
        Assert.Equal(["Old Radio", "Rusty Toolbox", "Worn Backpack"], items.Select(i => i.Name).Order());
        Assert.True(await WasProcessedAsync(notification.EventId));
    }

    [Fact]
    public async Task Handle_WhenEventIsDeliveredTwice_ShouldGrantPackOnce()
    {
        var userId = Guid.NewGuid();
        var notification = CreateEvent(userId);

        await HandleAsync(notification);
        await HandleAsync(notification);

        var items = await GetUserItemsAsync(userId);
        Assert.Equal(3, items.Count);
    }

    [Fact]
    public async Task Handle_WhenNoStarterItemsConfigured_ShouldOnlyStoreInboxRow()
    {
        var userId = Guid.NewGuid();
        var notification = CreateEvent(userId);

        await HandleAsync(notification, new InventoryOptions([]));

        Assert.Empty(await GetUserItemsAsync(userId));
        Assert.True(await WasProcessedAsync(notification.EventId));
    }
}

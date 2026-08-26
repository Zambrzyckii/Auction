using System.Text.Json;
using AuctionServer.Modules.Inventory.Application.Command.SellItemToShop;
using AuctionServer.Modules.Inventory.Domain.Enums;
using AuctionServer.Modules.Inventory.Domain.Exceptions;
using AuctionServer.Modules.Inventory.Infrastructure.Persistence;
using AuctionServer.Shared.Integration.Events;
using Microsoft.EntityFrameworkCore;

namespace AuctionServer.Modules.Inventory.Tests.IntegrationTests;

[Collection(InventoryIntegrationCollection.Name)]
public class SellItemToShopCommandHandlerTests(InventoryPostgresFixture fixture)
{
    private async Task HandleAsync(SellItemToShopCommand command)
    {
        await using var context = fixture.CreateContext();
        var handler = new SellItemToShopCommandHandler(new ItemRepository(context));
        await handler.Handle(command, CancellationToken.None);
    }

    private async Task<ItemSoldToShopEvent?> FindSoldEventAsync(Guid publicItemId)
    {
        await using var context = fixture.CreateContext();
        var messages = await context.OutboxMessages
            .Where(m => m.Type == nameof(ItemSoldToShopEvent))
            .ToListAsync();
        return messages
            .Select(m => JsonSerializer.Deserialize<ItemSoldToShopEvent>(m.Content)!)
            .SingleOrDefault(e => e.PublicItemId == publicItemId);
    }

    [Fact]
    public async Task Handle_WhenItemIsAvailable_ShouldMarkAsSoldAndWriteOutboxMessage()
    {
        var ownerId = Guid.NewGuid();
        var seeded = await fixture.SeedItemAsync(ownerId, ItemRarity.Rare);

        await HandleAsync(new SellItemToShopCommand(ownerId, seeded.PublicItemId));

        var item = await fixture.GetItemAsync(seeded.PublicItemId);
        Assert.Equal(ItemStatus.SoldToShop, item.Status);

        var soldEvent = await FindSoldEventAsync(seeded.PublicItemId);
        Assert.NotNull(soldEvent);
        Assert.NotEqual(Guid.Empty, soldEvent.EventId);
        Assert.Equal(ownerId, soldEvent.OwnerUserId);
        Assert.Equal(seeded.OfficialPrice, soldEvent.Price);
    }

    [Fact]
    public async Task Handle_WhenItemBelongsToAnotherUser_ShouldThrowAndWriteNothing()
    {
        var seeded = await fixture.SeedItemAsync(Guid.NewGuid());

        await Assert.ThrowsAsync<InventoryException.UserOrItemDoesntExistException>(
            () => HandleAsync(new SellItemToShopCommand(Guid.NewGuid(), seeded.PublicItemId)));

        var item = await fixture.GetItemAsync(seeded.PublicItemId);
        Assert.Equal(ItemStatus.Available, item.Status);
        Assert.Null(await FindSoldEventAsync(seeded.PublicItemId));
    }

    [Fact]
    public async Task Handle_WhenItemIsAlreadySold_ShouldThrowAndNotWriteOutboxMessage()
    {
        var ownerId = Guid.NewGuid();
        var seeded = await fixture.SeedItemAsync(ownerId, status: ItemStatus.SoldToShop);

        await Assert.ThrowsAsync<InventoryException.ItemNotAvailableException>(
            () => HandleAsync(new SellItemToShopCommand(ownerId, seeded.PublicItemId)));

        Assert.Null(await FindSoldEventAsync(seeded.PublicItemId));
    }
}

using AuctionServer.Modules.Inventory.Application.Command.GrantItem;
using AuctionServer.Modules.Inventory.Domain.Enums;
using AuctionServer.Modules.Inventory.Infrastructure.Persistence;

namespace AuctionServer.Modules.Inventory.Tests.IntegrationTests;

[Collection(InventoryIntegrationCollection.Name)]
public class GrantItemCommandHandlerTests(InventoryPostgresFixture fixture)
{
    private async Task<Guid> HandleAsync(GrantItemCommand command)
    {
        await using var context = fixture.CreateContext();
        var handler = new GrantItemCommandHandler(new ItemRepository(context));
        return await handler.Handle(command, CancellationToken.None);
    }

    [Fact]
    public async Task Handle_WhenCommandIsValid_ShouldPersistAvailableItemForOwner()
    {
        var ownerId = Guid.NewGuid();

        var itemId = await HandleAsync(new GrantItemCommand(ownerId, "Sword", ItemRarity.Epic));

        var item = await fixture.GetItemAsync(itemId);
        Assert.Equal(ownerId, item.OwnerUserId);
        Assert.Equal("Sword", item.Name);
        Assert.Equal(ItemRarity.Epic, item.Rarity);
        Assert.Equal(ItemStatus.Available, item.Status);
        Assert.InRange(item.OfficialPrice, 1_000m, 10_000m);
    }

    [Fact]
    public async Task Handle_WhenSameNameIsGrantedTwice_ShouldCreateTwoDistinctItems()
    {
        var ownerId = Guid.NewGuid();

        var firstId = await HandleAsync(new GrantItemCommand(ownerId, "Sword", ItemRarity.Common));
        var secondId = await HandleAsync(new GrantItemCommand(ownerId, "Sword", ItemRarity.Common));

        Assert.NotEqual(firstId, secondId);
    }
}

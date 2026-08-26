using AuctionServer.Modules.Inventory.Application.Command.CraftItem;
using AuctionServer.Modules.Inventory.Application.Queries.GetUserItemsQuery;
using AuctionServer.Modules.Inventory.Domain.Enums;
using AuctionServer.Modules.Inventory.Infrastructure.Persistence;

namespace AuctionServer.Modules.Inventory.Tests.IntegrationTests;

[Collection(InventoryIntegrationCollection.Name)]
public class GetUserItemsQueryHandlerTests(InventoryPostgresFixture fixture)
{
    private async Task<List<UserItemsDto>> HandleAsync(Guid ownerId)
    {
        await using var context = fixture.CreateContext();
        var handler = new GetUserItemsQueryHandler(new ItemRepository(context));
        return await handler.Handle(new GetUserItemsQuery(ownerId), CancellationToken.None);
    }

    [Fact]
    public async Task Handle_ShouldReturnOnlyItemsStillOwned()
    {
        var ownerId = Guid.NewGuid();
        var available = await fixture.SeedItemAsync(ownerId);
        var locked = await fixture.SeedItemAsync(ownerId, status: ItemStatus.LockedForAuction);
        await fixture.SeedItemAsync(ownerId, status: ItemStatus.SoldToShop);
        var ingredientIds = new List<Guid>();
        for (var i = 0; i < 3; i++) ingredientIds.Add((await fixture.SeedItemAsync(ownerId)).PublicItemId);

        Guid craftedId;
        await using (var context = fixture.CreateContext())
        {
            var craftHandler = new CraftItemCommandHandler(new ItemRepository(context));
            craftedId = await craftHandler.Handle(new CraftItemCommand(ownerId, ingredientIds), CancellationToken.None);
        }

        var result = await HandleAsync(ownerId);

        var returnedIds = result.Select(dto => dto.PublicItemId).ToHashSet();
        Assert.Equal(3, returnedIds.Count);
        Assert.Contains(available.PublicItemId, returnedIds);
        Assert.Contains(locked.PublicItemId, returnedIds);
        Assert.Contains(craftedId, returnedIds);
    }

    [Fact]
    public async Task Handle_ShouldMapEntityFieldsToDto()
    {
        var ownerId = Guid.NewGuid();
        var seeded = await fixture.SeedItemAsync(ownerId, ItemRarity.Epic);

        var result = await HandleAsync(ownerId);

        var dto = Assert.Single(result);
        Assert.Equal(seeded.PublicItemId, dto.PublicItemId);
        Assert.Equal(seeded.Name, dto.Name);
        Assert.Equal(ItemRarity.Epic, dto.Rarity);
        Assert.Equal(ItemStatus.Available, dto.Status);
        Assert.Equal(seeded.OfficialPrice, dto.OfficialPrice);
    }

    [Fact]
    public async Task Handle_WhenUserHasNoItems_ShouldReturnEmptyList()
    {
        var result = await HandleAsync(Guid.NewGuid());

        Assert.Empty(result);
    }
}

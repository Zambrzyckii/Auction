using AuctionServer.Modules.Inventory.Application.Command.CraftItem;
using AuctionServer.Modules.Inventory.Domain.Enums;
using AuctionServer.Modules.Inventory.Domain.Exceptions;
using AuctionServer.Modules.Inventory.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace AuctionServer.Modules.Inventory.Tests.IntegrationTests;

[Collection(InventoryIntegrationCollection.Name)]
public class CraftItemCommandHandlerTests(InventoryPostgresFixture fixture)
{
    private async Task<Guid> HandleAsync(CraftItemCommand command)
    {
        await using var context = fixture.CreateContext();
        var handler = new CraftItemCommandHandler(new ItemRepository(context));
        return await handler.Handle(command, CancellationToken.None);
    }

    private async Task<List<Guid>> SeedIngredientsAsync(Guid ownerId, params ItemRarity[] rarities)
    {
        var ids = new List<Guid>();
        foreach (var rarity in rarities) ids.Add((await fixture.SeedItemAsync(ownerId, rarity)).PublicItemId);
        return ids;
    }

    [Fact]
    public async Task Handle_WhenIngredientsAreValid_ShouldPersistCraftedItemAndConsumeIngredients()
    {
        var ownerId = Guid.NewGuid();
        var ingredientIds = await SeedIngredientsAsync(ownerId, ItemRarity.Common, ItemRarity.Common, ItemRarity.Common);

        var craftedId = await HandleAsync(new CraftItemCommand(ownerId, ingredientIds));

        var crafted = await fixture.GetItemAsync(craftedId);
        Assert.Equal(ownerId, crafted.OwnerUserId);
        Assert.Equal(ItemRarity.Rare, crafted.Rarity);
        Assert.Equal(ItemStatus.Available, crafted.Status);
        foreach (var id in ingredientIds)
            Assert.Equal(ItemStatus.Consumed, (await fixture.GetItemAsync(id)).Status);
    }

    [Fact]
    public async Task Handle_WhenOneIngredientBelongsToAnotherUser_ShouldThrowAndConsumeNothing()
    {
        var ownerId = Guid.NewGuid();
        var ownIds = await SeedIngredientsAsync(ownerId, ItemRarity.Common, ItemRarity.Common);
        var foreignId = (await fixture.SeedItemAsync(Guid.NewGuid())).PublicItemId;

        await Assert.ThrowsAsync<InventoryException.UserOrItemDoesntExistException>(
            () => HandleAsync(new CraftItemCommand(ownerId, [..ownIds, foreignId])));

        foreach (var id in ownIds)
            Assert.Equal(ItemStatus.Available, (await fixture.GetItemAsync(id)).Status);
    }

    [Fact]
    public async Task Handle_WhenIngredientsHaveDifferentRarity_ShouldThrowAndPersistNothing()
    {
        var ownerId = Guid.NewGuid();
        var ingredientIds = await SeedIngredientsAsync(ownerId, ItemRarity.Common, ItemRarity.Common, ItemRarity.Rare);

        await Assert.ThrowsAsync<InventoryException.IngredientsRarityMismatchException>(
            () => HandleAsync(new CraftItemCommand(ownerId, ingredientIds)));

        await using var context = fixture.CreateContext();
        Assert.Equal(3, await context.Items.CountAsync(i => i.OwnerUserId == ownerId));
        Assert.Equal(3, await context.Items.CountAsync(i => i.OwnerUserId == ownerId && i.Status == ItemStatus.Available));
    }
}

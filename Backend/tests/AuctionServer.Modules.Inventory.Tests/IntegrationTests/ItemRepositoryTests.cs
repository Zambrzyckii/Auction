using AuctionServer.Modules.Inventory.Domain.Entities;
using AuctionServer.Modules.Inventory.Domain.Enums;
using AuctionServer.Modules.Inventory.Domain.Exceptions;
using AuctionServer.Modules.Inventory.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace AuctionServer.Modules.Inventory.Tests.IntegrationTests;

[Collection(InventoryIntegrationCollection.Name)]
public class ItemRepositoryTests(InventoryPostgresFixture fixture)
{
    [Fact]
    public async Task GetUserItemAsync_WhenItemExists_ShouldReturnTrackedEntity()
    {
        var ownerId = Guid.NewGuid();
        var seeded = await fixture.SeedItemAsync(ownerId);

        await using var context = fixture.CreateContext();
        var repository = new ItemRepository(context);
        var item = await repository.GetUserItemAsync(ownerId, seeded.PublicItemId, CancellationToken.None);

        Assert.Equal(seeded.PublicItemId, item.PublicItemId);
        var entry = Assert.Single(context.ChangeTracker.Entries<Item>());
        Assert.Equal(EntityState.Unchanged, entry.State);
    }

    [Fact]
    public async Task GetUserItemAsync_WhenItemDoesNotExist_ShouldThrow()
    {
        await using var context = fixture.CreateContext();
        var repository = new ItemRepository(context);

        await Assert.ThrowsAsync<InventoryException.UserOrItemDoesntExistException>(
            () => repository.GetUserItemAsync(Guid.NewGuid(), Guid.NewGuid(), CancellationToken.None));
    }

    [Fact]
    public async Task GetUserItemAsync_WhenItemBelongsToAnotherUser_ShouldThrow()
    {
        var seeded = await fixture.SeedItemAsync(Guid.NewGuid());

        await using var context = fixture.CreateContext();
        var repository = new ItemRepository(context);

        await Assert.ThrowsAsync<InventoryException.UserOrItemDoesntExistException>(
            () => repository.GetUserItemAsync(Guid.NewGuid(), seeded.PublicItemId, CancellationToken.None));
    }

    [Fact]
    public async Task GetUserSelectedItemsAsync_WhenAllItemsExist_ShouldReturnAll()
    {
        var ownerId = Guid.NewGuid();
        var first = await fixture.SeedItemAsync(ownerId);
        var second = await fixture.SeedItemAsync(ownerId);
        var third = await fixture.SeedItemAsync(ownerId);
        var ids = new List<Guid> { first.PublicItemId, second.PublicItemId, third.PublicItemId };

        await using var context = fixture.CreateContext();
        var repository = new ItemRepository(context);
        var items = await repository.GetUserSelectedItemsAsync(ownerId, ids, CancellationToken.None);

        Assert.Equal(3, items.Count);
    }

    [Fact]
    public async Task GetUserSelectedItemsAsync_WhenSomeItemsAreMissing_ShouldThrow()
    {
        var ownerId = Guid.NewGuid();
        var existing = await fixture.SeedItemAsync(ownerId);
        var ids = new List<Guid> { existing.PublicItemId, Guid.NewGuid() };

        await using var context = fixture.CreateContext();
        var repository = new ItemRepository(context);

        await Assert.ThrowsAsync<InventoryException.UserOrItemDoesntExistException>(
            () => repository.GetUserSelectedItemsAsync(ownerId, ids, CancellationToken.None));
    }

    [Fact]
    public async Task GetUserItemsReadOnlyAsync_WhenUserHasNoItems_ShouldReturnEmptyList()
    {
        await using var context = fixture.CreateContext();
        var repository = new ItemRepository(context);

        var items = await repository.GetUserItemsReadOnlyAsync(Guid.NewGuid(), CancellationToken.None);

        Assert.Empty(items);
    }

    [Fact]
    public async Task GetUserItemsReadOnlyAsync_WhenItemsExist_ShouldNotTrackEntities()
    {
        var ownerId = Guid.NewGuid();
        await fixture.SeedItemAsync(ownerId);
        await fixture.SeedItemAsync(ownerId, ItemRarity.Rare);

        await using var context = fixture.CreateContext();
        var repository = new ItemRepository(context);
        var items = await repository.GetUserItemsReadOnlyAsync(ownerId, CancellationToken.None);

        Assert.Equal(2, items.Count);
        Assert.Empty(context.ChangeTracker.Entries<Item>());
    }

    [Fact]
    public async Task AddItemAsync_ShouldPersistItem()
    {
        var ownerId = Guid.NewGuid();
        var item = Item.Create(ownerId, "Persisted Item", ItemRarity.Epic);

        await using (var context = fixture.CreateContext())
        {
            var repository = new ItemRepository(context);
            await repository.AddItemAsync(item, CancellationToken.None);
        }

        await using var verifyContext = fixture.CreateContext();
        var saved = await verifyContext.Items.AsNoTracking().SingleAsync(i => i.PublicItemId == item.PublicItemId);
        Assert.Equal(ItemRarity.Epic, saved.Rarity);
        Assert.Equal(ownerId, saved.OwnerUserId);
    }

    [Fact]
    public async Task GetItemLockedForAuctionAsync_WhenItemIsLocked_ShouldReturnTrackedEntity()
    {
        var auctionId = Guid.NewGuid();
        var seeded = await fixture.SeedItemAsync(Guid.NewGuid(), status: ItemStatus.LockedForAuction, lockedForAuctionId: auctionId);

        await using var context = fixture.CreateContext();
        var repository = new ItemRepository(context);
        var item = await repository.GetItemLockedForAuctionAsync(auctionId, CancellationToken.None);

        Assert.Equal(seeded.PublicItemId, item.PublicItemId);
        var entry = Assert.Single(context.ChangeTracker.Entries<Item>());
        Assert.Equal(EntityState.Unchanged, entry.State);
    }

    [Fact]
    public async Task GetItemLockedForAuctionAsync_WhenNoItemIsLocked_ShouldThrow()
    {
        await using var context = fixture.CreateContext();
        var repository = new ItemRepository(context);

        await Assert.ThrowsAsync<InventoryException.UserOrItemDoesntExistException>(
            () => repository.GetItemLockedForAuctionAsync(Guid.NewGuid(), CancellationToken.None));
    }
}
using AuctionServer.Modules.Inventory.Domain.Entities;
using AuctionServer.Modules.Inventory.Domain.Enums;
using AuctionServer.Modules.Inventory.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Testcontainers.PostgreSql;

namespace AuctionServer.Modules.Inventory.Tests.IntegrationTests;

[CollectionDefinition(InventoryIntegrationCollection.Name)]
public sealed class InventoryIntegrationCollection : ICollectionFixture<InventoryPostgresFixture>
{
    public const string Name = "InventoryIntegration";
}

public sealed class InventoryPostgresFixture : IAsyncLifetime
{
    private readonly PostgreSqlContainer _dbContainer = new PostgreSqlBuilder()
        .WithImage("postgres:latest")
        .WithDatabase("inventory_integration_tests")
        .WithUsername("postgres")
        .WithPassword(Guid.NewGuid().ToString())
        .Build();

    public async Task InitializeAsync()
    {
        await _dbContainer.StartAsync();
        await using var context = CreateContext();
        await context.Database.MigrateAsync();
    }

    public async Task DisposeAsync() => await _dbContainer.DisposeAsync();

    public InventoryDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<InventoryDbContext>()
            .UseNpgsql(_dbContainer.GetConnectionString())
            .Options;
        return new InventoryDbContext(options);
    }

    public async Task<Item> SeedItemAsync(Guid ownerId, ItemRarity rarity = ItemRarity.Common,
        ItemStatus status = ItemStatus.Available)
    {
        await using var context = CreateContext();
        var item = Item.Create(ownerId, "Seeded Item", rarity);
        switch (status)
        {
            case ItemStatus.LockedForAuction: item.LockItem(); break;
            case ItemStatus.SoldToShop: item.SellToOfficialShop(); break;
            case ItemStatus.Consumed:
                throw new ArgumentException("Consumed items can only be produced by crafting", nameof(status));
        }
        context.Items.Add(item);
        await context.SaveChangesAsync();
        return item;
    }

    public async Task<Item> GetItemAsync(Guid publicItemId)
    {
        await using var context = CreateContext();
        return await context.Items.AsNoTracking().SingleAsync(i => i.PublicItemId == publicItemId);
    }
}

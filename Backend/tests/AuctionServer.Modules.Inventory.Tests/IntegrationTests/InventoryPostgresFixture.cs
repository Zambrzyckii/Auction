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
        // The Inventory module has no EF migrations yet, so the schema is created from the model.
        // Switch to MigrateAsync once the first migration exists.
        await context.Database.EnsureCreatedAsync();
    }

    public async Task DisposeAsync() => await _dbContainer.DisposeAsync();

    public InventoryDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<InventoryDbContext>()
            .UseNpgsql(_dbContainer.GetConnectionString())
            .Options;
        return new InventoryDbContext(options);
    }

    public async Task<Item> SeedItemAsync(Guid ownerId, ItemRarity rarity = ItemRarity.Common)
    {
        await using var context = CreateContext();
        var item = Item.Create(ownerId, "Seeded Item", rarity);
        context.Items.Add(item);
        await context.SaveChangesAsync();
        return item;
    }
}

using AuctionServer.Modules.Warehouses.Domain.Entities;
using AuctionServer.Modules.Warehouses.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Testcontainers.PostgreSql;

namespace AuctionServer.Modules.Warehouses.Tests.IntegrationTests;

[CollectionDefinition(WarehousesIntegrationCollection.Name)]
public sealed class WarehousesIntegrationCollection : ICollectionFixture<WarehousesPostgresFixture>
{
    public const string Name = "WarehousesIntegration";
}

public sealed class WarehousesPostgresFixture : IAsyncLifetime
{
    private readonly PostgreSqlContainer _dbContainer = new PostgreSqlBuilder()
        .WithImage("postgres:latest")
        .WithDatabase("warehouses_integration_tests")
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

    public WarehouseDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<WarehouseDbContext>()
            .UseNpgsql(_dbContainer.GetConnectionString())
            .Options;
        return new WarehouseDbContext(options);
    }

    public async Task<WarehouseWar> SeedWarAsync(string tier = "Small", decimal entryFee = 500m)
    {
        await using var context = CreateContext();
        var war = WarehouseWar.Create(tier, entryFee);
        context.Wars.Add(war);
        await context.SaveChangesAsync();
        return war;
    }

    public async Task<WarehouseWar> GetWarAsync(Guid publicWarehouseId)
    {
        await using var context = CreateContext();
        return await context.Wars.AsNoTracking().SingleAsync(w => w.PublicWarehouseId == publicWarehouseId);
    }

    public async Task<WarehouseWar> SeedOpenWarAsync(params Guid[] participantIds)
    {
        await using var context = CreateContext();
        var war = WarehouseWar.Create("Small", 500m);
        war.OpenLobby(totalValue: 350m, estimateMin: 200m, estimateMax: 600m);
        foreach (var userId in participantIds) war.Join(userId, maxPlayers: 5);
        context.Wars.Add(war);
        await context.SaveChangesAsync();
        return war;
    }
}

using AuctionServer.Modules.Wallets.Domain.Entities;
using AuctionServer.Modules.Wallets.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Testcontainers.PostgreSql;

namespace AuctionServer.Modules.Wallets.Tests.IntegrationTests;

[CollectionDefinition(WalletsIntegrationCollection.Name)]
public sealed class WalletsIntegrationCollection : ICollectionFixture<WalletsPostgresFixture>
{
    public const string Name = "WalletsIntegration";
}

public sealed class WalletsPostgresFixture : IAsyncLifetime
{
    private readonly PostgreSqlContainer _dbContainer = new PostgreSqlBuilder()
        .WithImage("postgres:latest")
        .WithDatabase("wallets_integration_tests")
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

    public WalletDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<WalletDbContext>()
            .UseNpgsql(_dbContainer.GetConnectionString())
            .Options;
        return new WalletDbContext(options);
    }

    public async Task<Guid> SeedWalletAsync(decimal availableFunds, decimal lockedFunds = 0m)
    {
        await using var context = CreateContext();
        var wallet = new Wallet { UserId = Guid.NewGuid() };
        var totalFunds = availableFunds + lockedFunds;
        if (totalFunds > 0) wallet.AddFunds(totalFunds);
        if (lockedFunds > 0) wallet.LockFunds(lockedFunds);
        context.Wallets.Add(wallet);
        await context.SaveChangesAsync();
        return wallet.UserId;
    }

    public async Task<Wallet> GetWalletAsync(Guid userId)
    {
        await using var context = CreateContext();
        return await context.Wallets.AsNoTracking().SingleAsync(w => w.UserId == userId);
    }

    public async Task<bool> WalletExistsAsync(Guid userId)
    {
        await using var context = CreateContext();
        return await context.Wallets.AnyAsync(w => w.UserId == userId);
    }
}

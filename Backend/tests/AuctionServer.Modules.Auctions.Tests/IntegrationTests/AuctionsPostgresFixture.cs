using AuctionServer.Modules.Auctions.Domain.Entities;
using AuctionServer.Modules.Auctions.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Testcontainers.PostgreSql;

namespace AuctionServer.Modules.Auctions.Tests.IntegrationTests;

[CollectionDefinition(AuctionsIntegrationCollection.Name)]
public sealed class AuctionsIntegrationCollection : ICollectionFixture<AuctionsPostgresFixture>
{
    public const string Name = "AuctionsIntegration";
}

public sealed class AuctionsPostgresFixture : IAsyncLifetime
{
    private readonly PostgreSqlContainer _dbContainer = new PostgreSqlBuilder()
        .WithImage("postgres:latest")
        .WithDatabase("auctions_integration_tests")
        .WithUsername("postgres")
        .WithPassword(Guid.NewGuid().ToString())
        .Build();

    public string ConnectionString => _dbContainer.GetConnectionString();

    public async Task InitializeAsync()
    {
        await _dbContainer.StartAsync();
        await using var context = CreateContext();
        await context.Database.MigrateAsync();
    }

    public async Task DisposeAsync() => await _dbContainer.DisposeAsync();

    public AuctionDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<AuctionDbContext>()
            .UseNpgsql(_dbContainer.GetConnectionString())
            .Options;
        return new AuctionDbContext(options);
    }

    public async Task<Auction> SeedAuctionAsync(Guid? sellerId = null, Guid? itemId = null, bool activate = false,
        DateTime? endsOn = null)
    {
        await using var context = CreateContext();
        var auction = Auction.Create(sellerId ?? Guid.NewGuid(), itemId ?? Guid.NewGuid(), 10m,
            endsOn ?? DateTime.UtcNow.AddMinutes(10));
        if (activate) auction.Activate("Seeded Item", "Common", 50m);
        context.Auctions.Add(auction);
        await context.SaveChangesAsync();
        return auction;
    }

    public async Task CancelAuctionAsync(Guid publicAuctionId, string reason)
    {
        await using var context = CreateContext();
        var auction = await context.Auctions.SingleAsync(a => a.PublicAuctionId == publicAuctionId);
        auction.Cancel(reason);
        await context.SaveChangesAsync();
    }

    public async Task<Auction> GetAuctionAsync(Guid publicAuctionId)
    {
        await using var context = CreateContext();
        return await context.Auctions.AsNoTracking().SingleAsync(a => a.PublicAuctionId == publicAuctionId);
    }
}
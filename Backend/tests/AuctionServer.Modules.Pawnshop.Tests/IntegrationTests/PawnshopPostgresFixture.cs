using AuctionServer.Modules.Pawnshop.Domain.Entities;
using AuctionServer.Modules.Pawnshop.Domain.Enums;
using AuctionServer.Modules.Pawnshop.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Testcontainers.PostgreSql;

namespace AuctionServer.Modules.Pawnshop.Tests.IntegrationTests;

[CollectionDefinition(PawnshopIntegrationCollection.Name)]
public sealed class PawnshopIntegrationCollection : ICollectionFixture<PawnshopPostgresFixture>
{
    public const string Name = "PawnshopIntegration";
}

public sealed class PawnshopPostgresFixture : IAsyncLifetime
{
    private readonly PostgreSqlContainer _dbContainer = new PostgreSqlBuilder("postgres:latest")
        .WithDatabase("pawnshop_integration_tests")
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

    public PawnshopDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<PawnshopDbContext>()
            .UseNpgsql(_dbContainer.GetConnectionString())
            .Options;
        return new PawnshopDbContext(options);
    }

    public async Task<Shop> SeedShopAsync(ShopStatus status = ShopStatus.PendingPayment, Guid? userId = null)
    {
        await using var context = CreateContext();
        var shop = Shop.Open(userId ?? Guid.NewGuid(), DateTime.UtcNow);
        if (status == ShopStatus.Active) shop.CompletePayment(shop.PendingPaymentId!.Value, DateTime.UtcNow);
        if (status == ShopStatus.Rejected) shop.RejectPayment(shop.PendingPaymentId!.Value, "Seeded as rejected");
        context.Shops.Add(shop);
        await context.SaveChangesAsync();
        return shop;
    }

    public async Task<Guid> BeginBotPurchaseAsync(Guid publicPawnshopId, string tierName = "Pawn Clerk",
        PawnshopRarity rarity = PawnshopRarity.Common, TimeSpan? spawnInterval = null, decimal payoutRate = 0.5m)
    {
        await using var context = CreateContext();
        var shop = await context.Shops.SingleAsync(s => s.PublicPawnshopId == publicPawnshopId);
        var paymentId = shop.BeginBotPurchase(tierName, rarity, spawnInterval ?? TimeSpan.FromSeconds(30),
            payoutRate, DateTime.UtcNow);
        await context.SaveChangesAsync();
        return paymentId;
    }

    public async Task<Shop> SeedShopWithBotAsync(decimal payoutRate = 0.5m, Guid? userId = null)
    {
        await using var context = CreateContext();
        var shop = Shop.Open(userId ?? Guid.NewGuid(), DateTime.UtcNow);
        shop.CompletePayment(shop.PendingPaymentId!.Value, DateTime.UtcNow);
        var paymentId = shop.BeginBotPurchase("Pawn Clerk", PawnshopRarity.Common, TimeSpan.FromSeconds(30),
            payoutRate, DateTime.UtcNow);
        shop.CompletePayment(paymentId, DateTime.UtcNow);
        context.Shops.Add(shop);
        await context.SaveChangesAsync();
        return shop;
    }

    public async Task<Guid> RequestSpawnAsync(Guid publicPawnshopId, DateTime requestedOn)
    {
        await using var context = CreateContext();
        var shop = await context.Shops.SingleAsync(s => s.PublicPawnshopId == publicPawnshopId);
        var (requestId, _) = shop.RequestSpawn(requestedOn);
        await context.SaveChangesAsync();
        return requestId;
    }

    public async Task<Shop> GetShopAsync(Guid publicPawnshopId)
    {
        await using var context = CreateContext();
        return await context.Shops.AsNoTracking().SingleAsync(s => s.PublicPawnshopId == publicPawnshopId);
    }
}

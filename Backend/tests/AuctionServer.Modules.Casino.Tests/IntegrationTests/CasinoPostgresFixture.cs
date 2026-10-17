using AuctionServer.Modules.Casino.Domain.Entities;
using AuctionServer.Modules.Casino.Domain.Enums;
using AuctionServer.Modules.Casino.Infrastructure.Persistence;
using AuctionServer.Modules.Casino.Tests.Domain.Cards;
using Microsoft.EntityFrameworkCore;
using Testcontainers.PostgreSql;

namespace AuctionServer.Modules.Casino.Tests.IntegrationTests;

[CollectionDefinition(CasinoIntegrationCollection.Name)]
public sealed class CasinoIntegrationCollection : ICollectionFixture<CasinoPostgresFixture>
{
    public const string Name = "CasinoIntegration";
}

public sealed class CasinoPostgresFixture : IAsyncLifetime
{
    private readonly PostgreSqlContainer _dbContainer = new PostgreSqlBuilder("postgres:latest")
        .WithDatabase("casino_integration_tests")
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

    public CasinoDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<CasinoDbContext>()
            .UseNpgsql(_dbContainer.GetConnectionString())
            .Options;
        return new CasinoDbContext(options);
    }

    public async Task<ChipAccount> SeedAccountAsync(decimal balance = 0m, Guid? userId = null)
    {
        await using var context = CreateContext();
        var account = ChipAccount.Open(userId ?? Guid.NewGuid(), DateTime.UtcNow);
        if (balance > 0) account.ReceivePurchase(balance);
        context.ChipAccounts.Add(account);
        await context.SaveChangesAsync();
        return account;
    }

    public async Task<ChipPurchase> SeedPurchaseAsync(Guid userId, decimal amount = 500m,
        ChipPurchaseStatus status = ChipPurchaseStatus.Pending)
    {
        await using var context = CreateContext();
        var purchase = ChipPurchase.Request(userId, amount, DateTime.UtcNow);
        if (status == ChipPurchaseStatus.Expired) purchase.Expire(DateTime.UtcNow);
        if (status == ChipPurchaseStatus.Rejected) purchase.Reject("Seeded as rejected", DateTime.UtcNow);
        if (status == ChipPurchaseStatus.Completed) purchase.Complete(DateTime.UtcNow);
        context.ChipPurchases.Add(purchase);
        await context.SaveChangesAsync();
        return purchase;
    }

    public async Task<BlackjackHand> SeedHandAsync(Guid userId, params string[] cards)
    {
        await using var context = CreateContext();
        var script = cards.Length == 0 ? ["5H", "10S", "6D", "7C"] : cards;
        var hand = BlackjackHand.Start(userId, 100m, new ScriptedCardSource(script), DateTime.UtcNow);
        context.BlackjackHands.Add(hand);
        await context.SaveChangesAsync();
        return hand;
    }

    public async Task<BlackjackHand> GetHandAsync(Guid publicHandId)
    {
        await using var context = CreateContext();
        return await context.BlackjackHands.AsNoTracking().SingleAsync(h => h.PublicHandId == publicHandId);
    }

    public async Task<ChipAccount> GetAccountAsync(Guid userId)
    {
        await using var context = CreateContext();
        return await context.ChipAccounts.AsNoTracking().SingleAsync(a => a.UserId == userId);
    }

    public async Task<ChipPurchase> GetPurchaseAsync(Guid publicPurchaseId)
    {
        await using var context = CreateContext();
        return await context.ChipPurchases.AsNoTracking().SingleAsync(p => p.PublicPurchaseId == publicPurchaseId);
    }
}

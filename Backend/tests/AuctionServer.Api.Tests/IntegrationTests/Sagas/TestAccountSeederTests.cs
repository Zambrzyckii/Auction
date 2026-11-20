using AuctionServer.Api.Infrastructure.TestAccount;
using AuctionServer.Modules.Identity.Domain.Entities;
using AuctionServer.Modules.Identity.Infrastructure.Persistence;
using AuctionServer.Modules.Inventory.Domain.Enums;
using AuctionServer.Modules.Inventory.Infrastructure.Persistence;
using AuctionServer.Modules.Profiles.Infrastructure.Persistence;
using AuctionServer.Modules.Wallets.Infrastructure.Persistence;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

namespace AuctionServer.Api.Tests.IntegrationTests.Sagas;

[Collection(SagaStageCollection.Name)]
public class TestAccountSeederTests(SagaStageFixture stage)
{
    private const string Email = "tester@saga.test";
    private const decimal Funds = 10_000_000m;
    private const decimal StartingFunds = 300m;
    private const decimal RewardsUpToLevel100 = 3_383_500m;
    private const decimal SeededFunds = StartingFunds + Funds + RewardsUpToLevel100;

    [Fact]
    public async Task Seeder_ShouldCreateARichPlayerOnceAndRefillItOnRestart()
    {
        await using (var first = await StartSeededHostAsync())
        {
            var userId = await FindPlayerAsync(first);
            await AssertWalletAsync(first, userId, SeededFunds, Funds);
            Assert.Equal(100, await LoadProfileLevelAsync(first, userId));
            await AssertHoldsTheCatalogOnceAsync(first, userId);
        }

        await using (var restarted = await StartSeededHostAsync())
        {
            var userId = await FindPlayerAsync(restarted);
            await AssertWalletAsync(restarted, userId, SeededFunds, Funds);
            await AssertHoldsTheCatalogOnceAsync(restarted, userId);
            await SpendAsync(restarted, userId);
        }

        await using (var refilled = await StartSeededHostAsync())
        {
            var userId = await FindPlayerAsync(refilled);
            await AssertWalletAsync(refilled, userId, 1m + Funds, 2 * Funds);
            await AssertHoldsTheCatalogOnceAsync(refilled, userId);
        }
    }

    private async Task<WebApplicationFactory<Program>> StartSeededHostAsync()
    {
        var host = stage.Factory.WithWebHostBuilder(builder =>
        {
            builder.UseSetting("TestAccount:Enabled", "true");
            builder.UseSetting("TestAccount:Email", Email);
            builder.UseSetting("TestAccount:Username", "SagaTester");
            builder.UseSetting("TestAccount:Password", "Tester123!");
            builder.UseSetting("TestAccount:Funds", "10000000");
            builder.UseSetting("TestAccount:Copies", "1");
        });

        var seeder = host.Services.GetServices<IHostedService>().OfType<TestAccountSeeder>().Single();
        Assert.NotNull(seeder.ExecuteTask);
        await seeder.ExecuteTask.WaitAsync(TimeSpan.FromMinutes(3));
        await stage.WaitForOutboxQuietAsync(fastForwardRetries: true);
        return host;
    }

    private static async Task<Guid> FindPlayerAsync(WebApplicationFactory<Program> host)
    {
        using var scope = host.Services.CreateScope();
        var identity = scope.ServiceProvider.GetRequiredService<IdentityDbContext>();
        var user = await identity.Users.AsNoTracking().SingleAsync(u => u.Email == Email);
        Assert.Equal(Role.User, user.UserRoles);
        return user.PublicUserId;
    }

    private static async Task AssertWalletAsync(WebApplicationFactory<Program> host, Guid userId, decimal available, decimal turnover)
    {
        using var scope = host.Services.CreateScope();
        var wallets = scope.ServiceProvider.GetRequiredService<WalletDbContext>();
        var wallet = await wallets.Wallets.AsNoTracking().SingleAsync(w => w.UserId == userId);
        Assert.Equal(available, wallet.AvailableFunds);
        Assert.Equal(turnover, wallet.LifetimeTurnover);
        Assert.Equal(100, wallet.RewardedLevel);
    }

    private static async Task<int> LoadProfileLevelAsync(WebApplicationFactory<Program> host, Guid userId)
    {
        using var scope = host.Services.CreateScope();
        var profiles = scope.ServiceProvider.GetRequiredService<ProfilesDbContext>();
        return await profiles.UserProfiles.AsNoTracking().Where(p => p.UserId == userId).Select(p => p.Level).SingleAsync();
    }

    private static async Task AssertHoldsTheCatalogOnceAsync(WebApplicationFactory<Program> host, Guid userId)
    {
        using var scope = host.Services.CreateScope();
        var inventory = scope.ServiceProvider.GetRequiredService<InventoryDbContext>();
        var owned = await inventory.Items.AsNoTracking()
            .Where(i => i.OwnerUserId == userId && i.Status != ItemStatus.SoldToShop && i.Status != ItemStatus.Consumed)
            .Select(i => new TestAccountItem(i.Name, i.Rarity))
            .ToListAsync();

        Assert.Empty(TestAccountCatalog.Missing(owned, 1));
        Assert.Equal(TestAccountCatalog.Items.Count, owned.Count(item => TestAccountCatalog.Items.Contains(item)));
    }

    private static async Task SpendAsync(WebApplicationFactory<Program> host, Guid userId)
    {
        using var scope = host.Services.CreateScope();
        var soldName = TestAccountCatalog.Items[0].Name;
        var inventory = scope.ServiceProvider.GetRequiredService<InventoryDbContext>();
        var sold = await inventory.Items.FirstAsync(i => i.OwnerUserId == userId && i.Name == soldName);
        sold.SellToOfficialShop();
        await inventory.SaveChangesAsync();

        var wallets = scope.ServiceProvider.GetRequiredService<WalletDbContext>();
        var wallet = await wallets.Wallets.SingleAsync(w => w.UserId == userId);
        wallet.Withdraw(wallet.AvailableFunds - 1m);
        await wallets.SaveChangesAsync();
    }
}

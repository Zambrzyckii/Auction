using AuctionServer.Modules.Auctions.Infrastructure.Persistence;
using AuctionServer.Modules.Banking.Infrastructure.Persistence;
using AuctionServer.Modules.Casino.Infrastructure.Persistence;
using AuctionServer.Modules.Identity.Infrastructure.Persistence;
using AuctionServer.Modules.Inventory.Infrastructure.Persistence;
using AuctionServer.Modules.Pawnshop.Infrastructure.Persistence;
using AuctionServer.Modules.Profiles.Infrastructure.Persistence;
using AuctionServer.Modules.Wallets.Infrastructure.Persistence;
using AuctionServer.Modules.Warehouses.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace AuctionServer.Api.Tests.IntegrationTests.PgBouncer;

[Collection(PgBouncerCollection.Name)]
public class PgBouncerMigrationTests(PgBouncerFixture fixture)
{
    [Theory]
    [InlineData(typeof(IdentityDbContext))]
    [InlineData(typeof(WalletDbContext))]
    [InlineData(typeof(AuctionDbContext))]
    [InlineData(typeof(InventoryDbContext))]
    [InlineData(typeof(WarehouseDbContext))]
    [InlineData(typeof(BankingDbContext))]
    [InlineData(typeof(PawnshopDbContext))]
    [InlineData(typeof(CasinoDbContext))]
    [InlineData(typeof(ProfilesDbContext))]
    public async Task Migrations_ThroughPgBouncer_ShouldLeaveNothingPending(Type contextType)
    {
        using var scope = fixture.Factory.Services.CreateScope();
        var context = (DbContext)scope.ServiceProvider.GetRequiredService(contextType);

        Assert.Empty(await context.Database.GetPendingMigrationsAsync());
    }
}

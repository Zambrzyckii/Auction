using Microsoft.EntityFrameworkCore;

namespace AuctionServer.Modules.Wallets.Tests.IntegrationTests;

[Collection(WalletsIntegrationCollection.Name)]
public class WalletConcurrencyTests(WalletsPostgresFixture fixture)
{
    [Fact]
    public async Task SaveChanges_WhenTwoContextsAddFundsToSameWallet_SecondSaveShouldThrow()
    {
        var userId = await fixture.SeedWalletAsync(500m);

        await using var firstContext = fixture.CreateContext();
        await using var secondContext = fixture.CreateContext();
        var firstWallet = await firstContext.Wallets.SingleAsync(w => w.UserId == userId);
        var secondWallet = await secondContext.Wallets.SingleAsync(w => w.UserId == userId);

        firstWallet.AddFunds(100m);
        await firstContext.SaveChangesAsync();

        secondWallet.AddFunds(200m);
        await Assert.ThrowsAsync<DbUpdateConcurrencyException>(() => secondContext.SaveChangesAsync());

        var persisted = await fixture.GetWalletAsync(userId);
        Assert.Equal(600m, persisted.AvailableFunds);
        Assert.Equal(0m, persisted.LockedFunds);
    }

    [Fact]
    public async Task SaveChanges_WhenTwoContextsLockFundsOnSameWallet_SecondSaveShouldThrow()
    {
        var userId = await fixture.SeedWalletAsync(500m);

        await using var firstContext = fixture.CreateContext();
        await using var secondContext = fixture.CreateContext();
        var firstWallet = await firstContext.Wallets.SingleAsync(w => w.UserId == userId);
        var secondWallet = await secondContext.Wallets.SingleAsync(w => w.UserId == userId);

        firstWallet.LockFunds(100m);
        await firstContext.SaveChangesAsync();

        secondWallet.LockFunds(50m);
        await Assert.ThrowsAsync<DbUpdateConcurrencyException>(() => secondContext.SaveChangesAsync());

        var persisted = await fixture.GetWalletAsync(userId);
        Assert.Equal(400m, persisted.AvailableFunds);
        Assert.Equal(100m, persisted.LockedFunds);
    }
}

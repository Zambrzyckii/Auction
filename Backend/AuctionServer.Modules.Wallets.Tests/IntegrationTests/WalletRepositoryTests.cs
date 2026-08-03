using AuctionServer.Modules.Wallets.Domain.Entities;
using AuctionServer.Modules.Wallets.Domain.Exceptions;
using AuctionServer.Modules.Wallets.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace AuctionServer.Modules.Wallets.Tests.IntegrationTests;

[Collection(WalletsIntegrationCollection.Name)]
public class WalletRepositoryTests(WalletsPostgresFixture fixture)
{
    [Fact]
    public async Task GetUserWalletByIdAsync_WhenWalletDoesNotExist_ShouldThrow()
    {
        await using var context = fixture.CreateContext();
        var repository = new WalletRepository(context);

        await Assert.ThrowsAsync<WalletExceptions.UserWithThisIdDontHaveWallet>(
            () => repository.GetUserWalletByIdAsync(Guid.NewGuid(), CancellationToken.None));
    }

    [Fact]
    public async Task GetUserWalletByIdAsyncReadOnly_WhenWalletDoesNotExist_ShouldThrow()
    {
        await using var context = fixture.CreateContext();
        var repository = new WalletRepository(context);

        await Assert.ThrowsAsync<WalletExceptions.UserWithThisIdDontHaveWallet>(
            () => repository.GetUserWalletByIdAsyncReadOnly(Guid.NewGuid(), CancellationToken.None));
    }

    [Fact]
    public async Task GetUserWalletByIdAsync_WhenWalletExists_ShouldReturnTrackedEntity()
    {
        var userId = await fixture.SeedWalletAsync(100m);

        await using var context = fixture.CreateContext();
        var repository = new WalletRepository(context);
        var wallet = await repository.GetUserWalletByIdAsync(userId, CancellationToken.None);

        Assert.NotNull(wallet);
        var entry = Assert.Single(context.ChangeTracker.Entries<Wallet>());
        Assert.Equal(EntityState.Unchanged, entry.State);
    }

    [Fact]
    public async Task GetUserWalletByIdAsyncReadOnly_WhenWalletExists_ShouldNotTrackEntity()
    {
        var userId = await fixture.SeedWalletAsync(100m);

        await using var context = fixture.CreateContext();
        var repository = new WalletRepository(context);
        var wallet = await repository.GetUserWalletByIdAsyncReadOnly(userId, CancellationToken.None);

        Assert.NotNull(wallet);
        Assert.Empty(context.ChangeTracker.Entries<Wallet>());
    }

    [Fact]
    public async Task SaveUserFundsAsync_WhenDuplicateUserId_ShouldThrow()
    {
        var userId = await fixture.SeedWalletAsync(100m);

        await using var context = fixture.CreateContext();
        context.Wallets.Add(new Wallet { UserId = userId });

        await Assert.ThrowsAsync<DbUpdateException>(() => context.SaveChangesAsync());
    }
}

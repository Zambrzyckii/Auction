using AuctionServer.Modules.Wallets.Application.Command.AddFunds;
using AuctionServer.Modules.Wallets.Domain.Exceptions;
using AuctionServer.Modules.Wallets.Infrastructure.Persistence;

namespace AuctionServer.Modules.Wallets.Tests.IntegrationTests;

[Collection(WalletsIntegrationCollection.Name)]
public class AddFundsCommandHandlerTests(WalletsPostgresFixture fixture)
{
    [Fact]
    public async Task Handle_WhenWalletExists_ShouldAddFundsAndPersistThem()
    {
        var userId = await fixture.SeedWalletAsync(0m);
        var versionBefore = (await fixture.GetWalletAsync(userId)).Version;

        await using var context = fixture.CreateContext();
        var handler = new AddFundsCommandHandler(new WalletRepository(context));
        await handler.Handle(new AddFundsCommand(userId, 100m), CancellationToken.None);

        var wallet = await fixture.GetWalletAsync(userId);
        Assert.Equal(100m, wallet.AvailableFunds);
        Assert.Equal(0m, wallet.LockedFunds);
        Assert.NotEqual(versionBefore, wallet.Version);
    }

    [Fact]
    public async Task Handle_WhenCalledTwice_ShouldAccumulateFunds()
    {
        var userId = await fixture.SeedWalletAsync(0m);

        await using (var context = fixture.CreateContext())
        {
            var handler = new AddFundsCommandHandler(new WalletRepository(context));
            await handler.Handle(new AddFundsCommand(userId, 100m), CancellationToken.None);
        }

        await using (var context = fixture.CreateContext())
        {
            var handler = new AddFundsCommandHandler(new WalletRepository(context));
            await handler.Handle(new AddFundsCommand(userId, 50m), CancellationToken.None);
        }

        var wallet = await fixture.GetWalletAsync(userId);
        Assert.Equal(150m, wallet.AvailableFunds);
    }

    [Fact]
    public async Task Handle_WhenAmountHasCents_ShouldPersistExactPrecision()
    {
        var userId = await fixture.SeedWalletAsync(0m);

        await using var context = fixture.CreateContext();
        var handler = new AddFundsCommandHandler(new WalletRepository(context));
        await handler.Handle(new AddFundsCommand(userId, 123.45m), CancellationToken.None);

        var wallet = await fixture.GetWalletAsync(userId);
        Assert.Equal(123.45m, wallet.AvailableFunds);
    }

    [Fact]
    public async Task Handle_WhenWalletDoesNotExist_ShouldThrowAndNotCreateWallet()
    {
        var missingUserId = Guid.NewGuid();

        await using var context = fixture.CreateContext();
        var handler = new AddFundsCommandHandler(new WalletRepository(context));

        await Assert.ThrowsAsync<WalletExceptions.UserWithThisIdDontHaveWallet>(
            () => handler.Handle(new AddFundsCommand(missingUserId, 100m), CancellationToken.None));
        Assert.False(await fixture.WalletExistsAsync(missingUserId));
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-100)]
    public async Task Handle_WhenAmountIsNotPositive_ShouldThrowAndNotChangeFunds(decimal amount)
    {
        var userId = await fixture.SeedWalletAsync(200m);
        var versionBefore = (await fixture.GetWalletAsync(userId)).Version;

        await using var context = fixture.CreateContext();
        var handler = new AddFundsCommandHandler(new WalletRepository(context));

        await Assert.ThrowsAsync<WalletExceptions.InvalidAmountException>(
            () => handler.Handle(new AddFundsCommand(userId, amount), CancellationToken.None));

        var wallet = await fixture.GetWalletAsync(userId);
        Assert.Equal(200m, wallet.AvailableFunds);
        Assert.Equal(versionBefore, wallet.Version);
    }
}

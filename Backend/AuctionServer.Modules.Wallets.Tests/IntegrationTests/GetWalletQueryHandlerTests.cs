using AuctionServer.Modules.Wallets.Application.Queries.GetWallet;
using AuctionServer.Modules.Wallets.Domain.Exceptions;
using AuctionServer.Modules.Wallets.Infrastructure.Persistence;

namespace AuctionServer.Modules.Wallets.Tests.IntegrationTests;

[Collection(WalletsIntegrationCollection.Name)]
public class GetWalletQueryHandlerTests(WalletsPostgresFixture fixture)
{
    [Fact]
    public async Task Handle_WhenWalletExists_ShouldReturnDtoWithFunds()
    {
        var userId = await fixture.SeedWalletAsync(400m, 100m);

        await using var context = fixture.CreateContext();
        var handler = new GetWalletQueryHandler(new WalletRepository(context));
        var result = await handler.Handle(new GetWalletQuery(userId), CancellationToken.None);

        Assert.Equal(400m, result.AvailableFunds);
        Assert.Equal(100m, result.LockedFunds);
    }

    [Fact]
    public async Task Handle_WhenWalletDoesNotExist_ShouldThrow()
    {
        await using var context = fixture.CreateContext();
        var handler = new GetWalletQueryHandler(new WalletRepository(context));

        await Assert.ThrowsAsync<WalletExceptions.UserWithThisIdDontHaveWallet>(
            () => handler.Handle(new GetWalletQuery(Guid.NewGuid()), CancellationToken.None));
    }
}

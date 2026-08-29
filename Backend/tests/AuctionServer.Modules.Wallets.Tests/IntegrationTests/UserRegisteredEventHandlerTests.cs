using AuctionServer.Modules.Wallets.Application;
using AuctionServer.Modules.Wallets.Application.Handlers;
using AuctionServer.Modules.Wallets.Infrastructure.Persistence;
using AuctionServer.Shared.Integration.Events;
using Microsoft.EntityFrameworkCore;

namespace AuctionServer.Modules.Wallets.Tests.IntegrationTests;

[Collection(WalletsIntegrationCollection.Name)]
public class UserRegisteredEventHandlerTests(WalletsPostgresFixture fixture)
{
    private static readonly WalletsOptions Options = new(StartingFunds: 1_000m);

    private static UserRegisteredEvent CreateEvent(Guid userId) =>
        new(Guid.NewGuid(), userId, $"{userId:N}@test.com");

    private async Task HandleAsync(UserRegisteredEvent notification)
    {
        await using var context = fixture.CreateContext();
        var handler = new UserRegisteredEventHandler(new WalletRepository(context), Options);
        await handler.Handle(notification, CancellationToken.None);
    }

    private async Task<int> CountWalletsAsync(Guid userId)
    {
        await using var context = fixture.CreateContext();
        return await context.Wallets.CountAsync(w => w.UserId == userId);
    }

    [Fact]
    public async Task Handle_WhenUserIsNew_ShouldCreateWalletWithStartingFunds()
    {
        var userId = Guid.NewGuid();

        await HandleAsync(CreateEvent(userId));

        var wallet = await fixture.GetWalletAsync(userId);
        Assert.Equal(1_000m, wallet.AvailableFunds);
        Assert.Equal(0m, wallet.LockedFunds);
    }

    [Fact]
    public async Task Handle_WhenEventIsDeliveredTwice_ShouldKeepOneWalletWithUnchangedFunds()
    {
        var userId = Guid.NewGuid();
        var notification = CreateEvent(userId);

        await HandleAsync(notification);
        await HandleAsync(notification);

        Assert.Equal(1, await CountWalletsAsync(userId));
        var wallet = await fixture.GetWalletAsync(userId);
        Assert.Equal(1_000m, wallet.AvailableFunds);
    }

    [Fact]
    public async Task Handle_WhenWalletAlreadyExistsWithDifferentBalance_ShouldNotOverwriteIt()
    {
        var userId = await fixture.SeedWalletAsync(availableFunds: 250m);

        await HandleAsync(CreateEvent(userId));

        var wallet = await fixture.GetWalletAsync(userId);
        Assert.Equal(250m, wallet.AvailableFunds);
    }
}

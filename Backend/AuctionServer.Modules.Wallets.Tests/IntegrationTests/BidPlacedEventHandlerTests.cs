using AuctionServer.Modules.Wallets.Application.Handlers;
using AuctionServer.Modules.Wallets.Domain.Exceptions;
using AuctionServer.Modules.Wallets.Infrastructure.Persistence;
using AuctionServer.Shared.Integration.Events;

namespace AuctionServer.Modules.Wallets.Tests.IntegrationTests;

[Collection(WalletsIntegrationCollection.Name)]
public class BidPlacedEventHandlerTests(WalletsPostgresFixture fixture)
{
    [Fact]
    public async Task Handle_WhenFirstBid_ShouldLockFundsOnNewWinner()
    {
        var userId = await fixture.SeedWalletAsync(500m);

        await using var context = fixture.CreateContext();
        var handler = new BidPlacedEventHandler(new WalletRepository(context));
        var bidEvent = new BidPlacedEvent(Guid.NewGuid(), userId, null, 100m, null);
        await handler.Handle(bidEvent, CancellationToken.None);

        var wallet = await fixture.GetWalletAsync(userId);
        Assert.Equal(400m, wallet.AvailableFunds);
        Assert.Equal(100m, wallet.LockedFunds);
    }

    [Fact]
    public async Task Handle_WhenOutbidByOtherUser_ShouldLockNewWinnerAndUnlockPreviousWinner()
    {
        var firstUserId = await fixture.SeedWalletAsync(500m);
        var secondUserId = await fixture.SeedWalletAsync(500m);
        var auctionId = Guid.NewGuid();

        await using (var context = fixture.CreateContext())
        {
            var handler = new BidPlacedEventHandler(new WalletRepository(context));
            await handler.Handle(new BidPlacedEvent(auctionId, firstUserId, null, 100m, null), CancellationToken.None);
        }

        await using (var context = fixture.CreateContext())
        {
            var handler = new BidPlacedEventHandler(new WalletRepository(context));
            await handler.Handle(new BidPlacedEvent(auctionId, secondUserId, firstUserId, 150m, 100m), CancellationToken.None);
        }

        var previousWinner = await fixture.GetWalletAsync(firstUserId);
        Assert.Equal(500m, previousWinner.AvailableFunds);
        Assert.Equal(0m, previousWinner.LockedFunds);

        var newWinner = await fixture.GetWalletAsync(secondUserId);
        Assert.Equal(350m, newWinner.AvailableFunds);
        Assert.Equal(150m, newWinner.LockedFunds);
    }

    [Fact]
    public async Task Handle_WhenUserOutbidsThemself_ShouldLockOnlyTheNewPrice()
    {
        var userId = await fixture.SeedWalletAsync(500m);
        var auctionId = Guid.NewGuid();

        await using (var context = fixture.CreateContext())
        {
            var handler = new BidPlacedEventHandler(new WalletRepository(context));
            await handler.Handle(new BidPlacedEvent(auctionId, userId, null, 100m, null), CancellationToken.None);
        }

        await using (var context = fixture.CreateContext())
        {
            var handler = new BidPlacedEventHandler(new WalletRepository(context));
            await handler.Handle(new BidPlacedEvent(auctionId, userId, userId, 150m, 100m), CancellationToken.None);
        }

        var wallet = await fixture.GetWalletAsync(userId);
        Assert.Equal(350m, wallet.AvailableFunds);
        Assert.Equal(150m, wallet.LockedFunds);
    }

    [Fact]
    public async Task Handle_WhenNewWinnerHasInsufficientFunds_ShouldThrowAndNotChangeAnyWallet()
    {
        var firstUserId = await fixture.SeedWalletAsync(500m);
        var secondUserId = await fixture.SeedWalletAsync(50m);
        var auctionId = Guid.NewGuid();

        await using (var context = fixture.CreateContext())
        {
            var handler = new BidPlacedEventHandler(new WalletRepository(context));
            await handler.Handle(new BidPlacedEvent(auctionId, firstUserId, null, 100m, null), CancellationToken.None);
        }

        await using (var context = fixture.CreateContext())
        {
            var handler = new BidPlacedEventHandler(new WalletRepository(context));
            await Assert.ThrowsAsync<WalletExceptions.InsufficientFundsException>(
                () => handler.Handle(new BidPlacedEvent(auctionId, secondUserId, firstUserId, 200m, 100m), CancellationToken.None));
        }

        var previousWinner = await fixture.GetWalletAsync(firstUserId);
        Assert.Equal(400m, previousWinner.AvailableFunds);
        Assert.Equal(100m, previousWinner.LockedFunds);

        var failedBidder = await fixture.GetWalletAsync(secondUserId);
        Assert.Equal(50m, failedBidder.AvailableFunds);
        Assert.Equal(0m, failedBidder.LockedFunds);
    }

    [Fact]
    public async Task Handle_WhenNewWinnerHasNoWallet_ShouldThrowAndNotUnlockPreviousWinner()
    {
        var firstUserId = await fixture.SeedWalletAsync(500m);
        var missingUserId = Guid.NewGuid();
        var auctionId = Guid.NewGuid();

        await using (var context = fixture.CreateContext())
        {
            var handler = new BidPlacedEventHandler(new WalletRepository(context));
            await handler.Handle(new BidPlacedEvent(auctionId, firstUserId, null, 100m, null), CancellationToken.None);
        }

        await using (var context = fixture.CreateContext())
        {
            var handler = new BidPlacedEventHandler(new WalletRepository(context));
            await Assert.ThrowsAsync<WalletExceptions.UserWithThisIdDontHaveWallet>(
                () => handler.Handle(new BidPlacedEvent(auctionId, missingUserId, firstUserId, 150m, 100m), CancellationToken.None));
        }

        var previousWinner = await fixture.GetWalletAsync(firstUserId);
        Assert.Equal(400m, previousWinner.AvailableFunds);
        Assert.Equal(100m, previousWinner.LockedFunds);
        Assert.False(await fixture.WalletExistsAsync(missingUserId));
    }

    [Fact]
    public async Task Handle_WhenPreviousWinnerHasNoWallet_ShouldThrowAndNotPersistLockOfNewWinner()
    {
        var secondUserId = await fixture.SeedWalletAsync(500m);
        var missingUserId = Guid.NewGuid();

        await using var context = fixture.CreateContext();
        var handler = new BidPlacedEventHandler(new WalletRepository(context));
        await Assert.ThrowsAsync<WalletExceptions.UserWithThisIdDontHaveWallet>(
            () => handler.Handle(new BidPlacedEvent(Guid.NewGuid(), secondUserId, missingUserId, 150m, 100m), CancellationToken.None));

        var newWinner = await fixture.GetWalletAsync(secondUserId);
        Assert.Equal(500m, newWinner.AvailableFunds);
        Assert.Equal(0m, newWinner.LockedFunds);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-100)]
    public async Task Handle_WhenNewPriceIsNotPositive_ShouldThrowAndNotChangeFunds(decimal newPrice)
    {
        var userId = await fixture.SeedWalletAsync(500m);

        await using var context = fixture.CreateContext();
        var handler = new BidPlacedEventHandler(new WalletRepository(context));
        await Assert.ThrowsAsync<WalletExceptions.InvalidAmountException>(
            () => handler.Handle(new BidPlacedEvent(Guid.NewGuid(), userId, null, newPrice, null), CancellationToken.None));

        var wallet = await fixture.GetWalletAsync(userId);
        Assert.Equal(500m, wallet.AvailableFunds);
        Assert.Equal(0m, wallet.LockedFunds);
    }
}

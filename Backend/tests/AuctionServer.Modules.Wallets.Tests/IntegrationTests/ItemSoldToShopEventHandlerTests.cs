using AuctionServer.Modules.Wallets.Application.Handlers;
using AuctionServer.Modules.Wallets.Domain.Exceptions;
using AuctionServer.Modules.Wallets.Infrastructure.Persistence;
using AuctionServer.Shared.Integration.Events;
using Microsoft.EntityFrameworkCore;

namespace AuctionServer.Modules.Wallets.Tests.IntegrationTests;

[Collection(WalletsIntegrationCollection.Name)]
public class ItemSoldToShopEventHandlerTests(WalletsPostgresFixture fixture)
{
    private static ItemSoldToShopEvent CreateEvent(Guid ownerId, decimal price) =>
        new(Guid.NewGuid(), Guid.NewGuid(), ownerId, price);

    private async Task HandleAsync(ItemSoldToShopEvent notification)
    {
        await using var context = fixture.CreateContext();
        var handler = new ItemSoldToShopEventHandler(new WalletRepository(context));
        await handler.Handle(notification, CancellationToken.None);
    }

    private async Task<bool> InboxContainsAsync(Guid eventId)
    {
        await using var context = fixture.CreateContext();
        return await context.ProcessedMessages.AnyAsync(m => m.EventId == eventId);
    }

    [Fact]
    public async Task Handle_WhenWalletExists_ShouldCreditPriceAndStoreInboxRow()
    {
        var ownerId = await fixture.SeedWalletAsync(availableFunds: 100m);
        var notification = CreateEvent(ownerId, 40m);

        await HandleAsync(notification);

        var wallet = await fixture.GetWalletAsync(ownerId);
        Assert.Equal(140m, wallet.AvailableFunds);
        Assert.True(await InboxContainsAsync(notification.EventId));
    }

    [Fact]
    public async Task Handle_WhenEventIsDeliveredTwice_ShouldCreditOnlyOnce()
    {
        var ownerId = await fixture.SeedWalletAsync(availableFunds: 100m);
        var notification = CreateEvent(ownerId, 40m);

        await HandleAsync(notification);
        await HandleAsync(notification);

        var wallet = await fixture.GetWalletAsync(ownerId);
        Assert.Equal(140m, wallet.AvailableFunds);
    }

    [Fact]
    public async Task Handle_WhenWalletDoesNotExist_ShouldThrowAndStoreNoInboxRow()
    {
        var notification = CreateEvent(Guid.NewGuid(), 40m);

        await Assert.ThrowsAsync<WalletExceptions.UserWithThisIdDontHaveWallet>(() => HandleAsync(notification));

        Assert.False(await InboxContainsAsync(notification.EventId));
    }
}

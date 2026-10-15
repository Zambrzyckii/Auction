using AuctionServer.Modules.Wallets.Application.Handlers;
using AuctionServer.Modules.Wallets.Infrastructure.Persistence;
using AuctionServer.Shared.Integration.Events.Pawnshop;
using Microsoft.EntityFrameworkCore;

namespace AuctionServer.Modules.Wallets.Tests.IntegrationTests;

[Collection(WalletsIntegrationCollection.Name)]
public class PawnshopPayoutEventHandlerTests(WalletsPostgresFixture fixture)
{
    private async Task HandleAsync(PawnshopPayoutEvent notification)
    {
        await using var context = fixture.CreateContext();
        var handler = new PawnshopPayoutEventHandler(new WalletRepository(context));
        await handler.Handle(notification, CancellationToken.None);
    }

    [Fact]
    public async Task Handle_ShouldCreditPayoutAndBuildTurnover()
    {
        var userId = await fixture.SeedWalletAsync(500m);
        var notification = new PawnshopPayoutEvent(Guid.NewGuid(), Guid.NewGuid(), userId, 27.73m);

        await HandleAsync(notification);

        var wallet = await fixture.GetWalletAsync(userId);
        Assert.Equal(527.73m, wallet.AvailableFunds);
        Assert.Equal(527.73m, wallet.LifetimeTurnover);
        await using var context = fixture.CreateContext();
        Assert.True(await context.ProcessedMessages.AnyAsync(m => m.EventId == notification.EventId));
    }

    [Fact]
    public async Task Handle_WhenDeliveredTwice_ShouldCreditOnce()
    {
        var userId = await fixture.SeedWalletAsync(500m);
        var notification = new PawnshopPayoutEvent(Guid.NewGuid(), Guid.NewGuid(), userId, 27.73m);

        await HandleAsync(notification);
        await HandleAsync(notification);

        var wallet = await fixture.GetWalletAsync(userId);
        Assert.Equal(527.73m, wallet.AvailableFunds);
        Assert.Equal(527.73m, wallet.LifetimeTurnover);
    }
}

using AuctionServer.Modules.Wallets.Application.Handlers;
using AuctionServer.Modules.Wallets.Infrastructure.Persistence;
using AuctionServer.Shared.Integration.Events.Casino;
using Microsoft.EntityFrameworkCore;

namespace AuctionServer.Modules.Wallets.Tests.IntegrationTests;

[Collection(WalletsIntegrationCollection.Name)]
public class CasinoCashOutEventHandlerTests(WalletsPostgresFixture fixture)
{
    private async Task HandleAsync(CasinoCashOutEvent notification)
    {
        await using var context = fixture.CreateContext();
        var handler = new CasinoCashOutEventHandler(new WalletRepository(context));
        await handler.Handle(notification, CancellationToken.None);
    }

    [Fact]
    public async Task Handle_ShouldCreditWithoutTurnover()
    {
        var userId = await fixture.SeedWalletAsync(500m);
        var notification = new CasinoCashOutEvent(Guid.NewGuid(), userId, 487.5m);

        await HandleAsync(notification);

        var wallet = await fixture.GetWalletAsync(userId);
        Assert.Equal(987.5m, wallet.AvailableFunds);
        Assert.Equal(500m, wallet.LifetimeTurnover);
        await using var context = fixture.CreateContext();
        Assert.True(await context.ProcessedMessages.AnyAsync(m => m.EventId == notification.EventId));
    }

    [Fact]
    public async Task Handle_WhenDeliveredTwice_ShouldCreditOnce()
    {
        var userId = await fixture.SeedWalletAsync(500m);
        var notification = new CasinoCashOutEvent(Guid.NewGuid(), userId, 487.5m);

        await HandleAsync(notification);
        await HandleAsync(notification);

        var wallet = await fixture.GetWalletAsync(userId);
        Assert.Equal(987.5m, wallet.AvailableFunds);
        Assert.Equal(500m, wallet.LifetimeTurnover);
    }
}

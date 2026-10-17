using System.Text.Json;
using AuctionServer.Modules.Wallets.Application.Handlers;
using AuctionServer.Modules.Wallets.Infrastructure.Persistence;
using AuctionServer.Shared.Integration.Events.Casino;
using Microsoft.EntityFrameworkCore;

namespace AuctionServer.Modules.Wallets.Tests.IntegrationTests;

[Collection(WalletsIntegrationCollection.Name)]
public class CasinoChipPurchaseRequestedEventHandlerTests(WalletsPostgresFixture fixture)
{
    private async Task HandleAsync(CasinoChipPurchaseRequestedEvent notification)
    {
        await using var context = fixture.CreateContext();
        var handler = new CasinoChipPurchaseRequestedEventHandler(new WalletRepository(context));
        await handler.Handle(notification, CancellationToken.None);
    }

    private static CasinoChipPurchaseRequestedEvent BuildRequest(Guid userId, decimal amount) =>
        new(Guid.NewGuid(), Guid.NewGuid(), userId, amount);

    [Fact]
    public async Task Handle_WhenFundsSuffice_ShouldDebitWithoutTurnoverAndReplyCompleted()
    {
        var userId = await fixture.SeedWalletAsync(500m);
        var notification = BuildRequest(userId, 300m);

        await HandleAsync(notification);

        var wallet = await fixture.GetWalletAsync(userId);
        Assert.Equal(200m, wallet.AvailableFunds);
        Assert.Equal(500m, wallet.LifetimeTurnover);

        await using var context = fixture.CreateContext();
        var outboxMessage = await context.OutboxMessages
            .SingleAsync(m => m.Type == nameof(CasinoChipPurchaseCompletedEvent)
                              && m.Content.Contains(notification.PublicPurchaseId.ToString()));
        var completed = JsonSerializer.Deserialize<CasinoChipPurchaseCompletedEvent>(outboxMessage.Content);
        Assert.NotNull(completed);
        Assert.Equal(outboxMessage.Id, completed.EventId);
        Assert.True(await context.ProcessedMessages.AnyAsync(m => m.EventId == notification.EventId));
    }

    [Fact]
    public async Task Handle_WhenFundsInsufficient_ShouldReplyRejectedWithoutDebit()
    {
        var userId = await fixture.SeedWalletAsync(500m);
        var notification = BuildRequest(userId, 600m);

        await HandleAsync(notification);

        var wallet = await fixture.GetWalletAsync(userId);
        Assert.Equal(500m, wallet.AvailableFunds);

        await using var context = fixture.CreateContext();
        var outboxMessage = await context.OutboxMessages
            .SingleAsync(m => m.Type == nameof(CasinoChipPurchaseRejectedEvent)
                              && m.Content.Contains(notification.PublicPurchaseId.ToString()));
        var rejected = JsonSerializer.Deserialize<CasinoChipPurchaseRejectedEvent>(outboxMessage.Content);
        Assert.NotNull(rejected);
        Assert.False(string.IsNullOrWhiteSpace(rejected.Reason));
        Assert.True(await context.ProcessedMessages.AnyAsync(m => m.EventId == notification.EventId));
    }

    [Fact]
    public async Task Handle_WhenDeliveredTwice_ShouldDebitOnce()
    {
        var userId = await fixture.SeedWalletAsync(500m);
        var notification = BuildRequest(userId, 300m);

        await HandleAsync(notification);
        await HandleAsync(notification);

        var wallet = await fixture.GetWalletAsync(userId);
        Assert.Equal(200m, wallet.AvailableFunds);
        await using var context = fixture.CreateContext();
        Assert.Equal(1, await context.OutboxMessages.CountAsync(
            m => m.Content.Contains(notification.PublicPurchaseId.ToString())));
    }
}

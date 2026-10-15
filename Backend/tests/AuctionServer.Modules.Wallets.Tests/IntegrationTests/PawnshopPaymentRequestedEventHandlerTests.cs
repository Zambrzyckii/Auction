using System.Text.Json;
using AuctionServer.Modules.Wallets.Application.Handlers;
using AuctionServer.Modules.Wallets.Infrastructure.Persistence;
using AuctionServer.Shared.Integration.Events.Pawnshop;
using Microsoft.EntityFrameworkCore;

namespace AuctionServer.Modules.Wallets.Tests.IntegrationTests;

[Collection(WalletsIntegrationCollection.Name)]
public class PawnshopPaymentRequestedEventHandlerTests(WalletsPostgresFixture fixture)
{
    private async Task HandleAsync(PawnshopPaymentRequestedEvent notification)
    {
        await using var context = fixture.CreateContext();
        var handler = new PawnshopPaymentRequestedEventHandler(new WalletRepository(context));
        await handler.Handle(notification, CancellationToken.None);
    }

    private static PawnshopPaymentRequestedEvent BuildRequest(Guid userId, decimal amount, decimal requiredTurnover) =>
        new(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), userId, amount, requiredTurnover);

    [Fact]
    public async Task Handle_WhenEligible_ShouldDebitAndReplyCompleted()
    {
        var userId = await fixture.SeedWalletAsync(500m);
        var notification = BuildRequest(userId, 300m, 400m);

        await HandleAsync(notification);

        var wallet = await fixture.GetWalletAsync(userId);
        Assert.Equal(200m, wallet.AvailableFunds);
        Assert.Equal(500m, wallet.LifetimeTurnover);

        await using var context = fixture.CreateContext();
        var outboxMessage = await context.OutboxMessages
            .SingleAsync(m => m.Type == nameof(PawnshopPaymentCompletedEvent)
                              && m.Content.Contains(notification.PaymentId.ToString()));
        var completed = JsonSerializer.Deserialize<PawnshopPaymentCompletedEvent>(outboxMessage.Content);
        Assert.NotNull(completed);
        Assert.Equal(outboxMessage.Id, completed.EventId);
        Assert.Equal(notification.PublicPawnshopId, completed.PublicPawnshopId);
        Assert.True(await context.ProcessedMessages.AnyAsync(m => m.EventId == notification.EventId));
    }

    [Fact]
    public async Task Handle_WhenTurnoverTooLow_ShouldReplyRejectedWithoutDebit()
    {
        var userId = await fixture.SeedWalletAsync(500m);
        var notification = BuildRequest(userId, 300m, 1000m);

        await HandleAsync(notification);

        var wallet = await fixture.GetWalletAsync(userId);
        Assert.Equal(500m, wallet.AvailableFunds);

        await using var context = fixture.CreateContext();
        var outboxMessage = await context.OutboxMessages
            .SingleAsync(m => m.Type == nameof(PawnshopPaymentRejectedEvent)
                              && m.Content.Contains(notification.PaymentId.ToString()));
        var rejected = JsonSerializer.Deserialize<PawnshopPaymentRejectedEvent>(outboxMessage.Content);
        Assert.NotNull(rejected);
        Assert.False(string.IsNullOrWhiteSpace(rejected.Reason));
        Assert.True(await context.ProcessedMessages.AnyAsync(m => m.EventId == notification.EventId));
    }

    [Fact]
    public async Task Handle_WhenFundsInsufficient_ShouldReplyRejectedWithoutDebit()
    {
        var userId = await fixture.SeedWalletAsync(500m);
        var notification = BuildRequest(userId, 600m, 400m);

        await HandleAsync(notification);

        var wallet = await fixture.GetWalletAsync(userId);
        Assert.Equal(500m, wallet.AvailableFunds);

        await using var context = fixture.CreateContext();
        Assert.Equal(1, await context.OutboxMessages.CountAsync(
            m => m.Type == nameof(PawnshopPaymentRejectedEvent)
                 && m.Content.Contains(notification.PaymentId.ToString())));
    }

    [Fact]
    public async Task Handle_WhenDeliveredTwice_ShouldDebitOnce()
    {
        var userId = await fixture.SeedWalletAsync(500m);
        var notification = BuildRequest(userId, 300m, 0m);

        await HandleAsync(notification);
        await HandleAsync(notification);

        var wallet = await fixture.GetWalletAsync(userId);
        Assert.Equal(200m, wallet.AvailableFunds);
        await using var context = fixture.CreateContext();
        Assert.Equal(1, await context.OutboxMessages.CountAsync(m => m.Content.Contains(notification.PaymentId.ToString())));
    }
}

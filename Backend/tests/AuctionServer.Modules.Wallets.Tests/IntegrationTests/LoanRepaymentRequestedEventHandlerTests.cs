using System.Text.Json;
using AuctionServer.Modules.Wallets.Application.Handlers;
using AuctionServer.Modules.Wallets.Domain.Exceptions;
using AuctionServer.Modules.Wallets.Infrastructure.Persistence;
using AuctionServer.Shared.Integration.Events.Banking;
using Microsoft.EntityFrameworkCore;

namespace AuctionServer.Modules.Wallets.Tests.IntegrationTests;

[Collection(WalletsIntegrationCollection.Name)]
public class LoanRepaymentRequestedEventHandlerTests(WalletsPostgresFixture fixture)
{
    private async Task HandleAsync(LoanRepaymentRequestedEvent notification)
    {
        await using var context = fixture.CreateContext();
        var handler = new LoanRepaymentRequestedEventHandler(new WalletRepository(context));
        await handler.Handle(notification, CancellationToken.None);
    }

    [Fact]
    public async Task Handle_WhenFundsCoverAmount_ShouldDebitAndReplyCollected()
    {
        var userId = await fixture.SeedWalletAsync(500m);
        var loanId = Guid.NewGuid();
        var notification = new LoanRepaymentRequestedEvent(Guid.NewGuid(), loanId, userId, 220m);

        await HandleAsync(notification);

        var wallet = await fixture.GetWalletAsync(userId);
        Assert.Equal(280m, wallet.AvailableFunds);
        Assert.Equal(500m, wallet.LifetimeTurnover);

        await using var context = fixture.CreateContext();
        var outboxMessage = await context.OutboxMessages
            .SingleAsync(m => m.Type == nameof(LoanRepaymentCollectedEvent) && m.Content.Contains(loanId.ToString()));
        var collected = JsonSerializer.Deserialize<LoanRepaymentCollectedEvent>(outboxMessage.Content);
        Assert.NotNull(collected);
        Assert.Equal(outboxMessage.Id, collected.EventId);
        Assert.Equal(220m, collected.AmountCollected);
        Assert.True(await context.ProcessedMessages.AnyAsync(m => m.EventId == notification.EventId));
    }

    [Fact]
    public async Task Handle_WhenFundsPartiallyCover_ShouldCollectEverythingAvailable()
    {
        var userId = await fixture.SeedWalletAsync(100m);
        var loanId = Guid.NewGuid();
        var notification = new LoanRepaymentRequestedEvent(Guid.NewGuid(), loanId, userId, 220m);

        await HandleAsync(notification);

        var wallet = await fixture.GetWalletAsync(userId);
        Assert.Equal(0m, wallet.AvailableFunds);

        await using var context = fixture.CreateContext();
        var outboxMessage = await context.OutboxMessages
            .SingleAsync(m => m.Type == nameof(LoanRepaymentCollectedEvent) && m.Content.Contains(loanId.ToString()));
        var collected = JsonSerializer.Deserialize<LoanRepaymentCollectedEvent>(outboxMessage.Content);
        Assert.NotNull(collected);
        Assert.Equal(100m, collected.AmountCollected);
    }

    [Fact]
    public async Task Handle_WhenWalletEmpty_ShouldReplyZeroCollected()
    {
        var userId = await fixture.SeedWalletAsync(0m);
        var loanId = Guid.NewGuid();
        var notification = new LoanRepaymentRequestedEvent(Guid.NewGuid(), loanId, userId, 220m);

        await HandleAsync(notification);

        var wallet = await fixture.GetWalletAsync(userId);
        Assert.Equal(0m, wallet.AvailableFunds);

        await using var context = fixture.CreateContext();
        var outboxMessage = await context.OutboxMessages
            .SingleAsync(m => m.Type == nameof(LoanRepaymentCollectedEvent) && m.Content.Contains(loanId.ToString()));
        var collected = JsonSerializer.Deserialize<LoanRepaymentCollectedEvent>(outboxMessage.Content);
        Assert.NotNull(collected);
        Assert.Equal(0m, collected.AmountCollected);
        Assert.True(await context.ProcessedMessages.AnyAsync(m => m.EventId == notification.EventId));
    }

    [Fact]
    public async Task Handle_WhenDeliveredTwice_ShouldDebitOnce()
    {
        var userId = await fixture.SeedWalletAsync(500m);
        var loanId = Guid.NewGuid();
        var notification = new LoanRepaymentRequestedEvent(Guid.NewGuid(), loanId, userId, 220m);

        await HandleAsync(notification);
        await HandleAsync(notification);

        var wallet = await fixture.GetWalletAsync(userId);
        Assert.Equal(280m, wallet.AvailableFunds);
        await using var context = fixture.CreateContext();
        Assert.Equal(1, await context.OutboxMessages.CountAsync(m => m.Content.Contains(loanId.ToString())));
    }

    [Fact]
    public async Task Handle_WhenWalletMissing_ShouldThrowWithoutInboxRow()
    {
        var notification = new LoanRepaymentRequestedEvent(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), 220m);

        await Assert.ThrowsAsync<WalletExceptions.UserWithThisIdDontHaveWallet>(() => HandleAsync(notification));

        await using var context = fixture.CreateContext();
        Assert.False(await context.ProcessedMessages.AnyAsync(m => m.EventId == notification.EventId));
    }
}

using System.Text.Json;
using AuctionServer.Modules.Wallets.Application.Handlers;
using AuctionServer.Modules.Wallets.Domain.Exceptions;
using AuctionServer.Modules.Wallets.Infrastructure.Persistence;
using AuctionServer.Shared.Integration.Events.Banking;
using Microsoft.EntityFrameworkCore;

namespace AuctionServer.Modules.Wallets.Tests.IntegrationTests;

[Collection(WalletsIntegrationCollection.Name)]
public class LoanRequestedEventHandlerTests(WalletsPostgresFixture fixture)
{
    private async Task HandleAsync(LoanRequestedEvent notification)
    {
        await using var context = fixture.CreateContext();
        var handler = new LoanRequestedEventHandler(new WalletRepository(context));
        await handler.Handle(notification, CancellationToken.None);
    }

    [Fact]
    public async Task Handle_WhenTurnoverSufficient_ShouldCreditPrincipalAndReplyApproved()
    {
        var userId = await fixture.SeedWalletAsync(500m);
        var loanId = Guid.NewGuid();
        var notification = new LoanRequestedEvent(Guid.NewGuid(), loanId, userId, 200m, 400m);

        await HandleAsync(notification);

        var wallet = await fixture.GetWalletAsync(userId);
        Assert.Equal(700m, wallet.AvailableFunds);
        Assert.Equal(700m, wallet.LifetimeTurnover);

        await using var context = fixture.CreateContext();
        var outboxMessage = await context.OutboxMessages
            .SingleAsync(m => m.Type == nameof(LoanApprovedEvent) && m.Content.Contains(loanId.ToString()));
        var approved = JsonSerializer.Deserialize<LoanApprovedEvent>(outboxMessage.Content);
        Assert.NotNull(approved);
        Assert.Equal(outboxMessage.Id, approved.EventId);
        Assert.True(await context.ProcessedMessages.AnyAsync(m => m.EventId == notification.EventId));
    }

    [Fact]
    public async Task Handle_WhenTurnoverInsufficient_ShouldReplyRejectedWithoutCredit()
    {
        var userId = await fixture.SeedWalletAsync(300m);
        var loanId = Guid.NewGuid();
        var notification = new LoanRequestedEvent(Guid.NewGuid(), loanId, userId, 200m, 400m);

        await HandleAsync(notification);

        var wallet = await fixture.GetWalletAsync(userId);
        Assert.Equal(300m, wallet.AvailableFunds);
        Assert.Equal(300m, wallet.LifetimeTurnover);

        await using var context = fixture.CreateContext();
        var outboxMessage = await context.OutboxMessages
            .SingleAsync(m => m.Type == nameof(LoanRejectedEvent) && m.Content.Contains(loanId.ToString()));
        var rejected = JsonSerializer.Deserialize<LoanRejectedEvent>(outboxMessage.Content);
        Assert.NotNull(rejected);
        Assert.Equal(outboxMessage.Id, rejected.EventId);
        Assert.Contains("400", rejected.Reason);
        Assert.True(await context.ProcessedMessages.AnyAsync(m => m.EventId == notification.EventId));
    }

    [Fact]
    public async Task Handle_WhenDeliveredTwice_ShouldCreditOnce()
    {
        var userId = await fixture.SeedWalletAsync(500m);
        var loanId = Guid.NewGuid();
        var notification = new LoanRequestedEvent(Guid.NewGuid(), loanId, userId, 200m, 400m);

        await HandleAsync(notification);
        await HandleAsync(notification);

        var wallet = await fixture.GetWalletAsync(userId);
        Assert.Equal(700m, wallet.AvailableFunds);
        await using var context = fixture.CreateContext();
        Assert.Equal(1, await context.OutboxMessages.CountAsync(m => m.Content.Contains(loanId.ToString())));
    }

    [Fact]
    public async Task Handle_WhenWalletMissing_ShouldThrowWithoutInboxRow()
    {
        var notification = new LoanRequestedEvent(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), 200m, 400m);

        await Assert.ThrowsAsync<WalletExceptions.UserWithThisIdDontHaveWallet>(() => HandleAsync(notification));

        await using var context = fixture.CreateContext();
        Assert.False(await context.ProcessedMessages.AnyAsync(m => m.EventId == notification.EventId));
    }
}

using AuctionServer.Modules.Casino.Application.Handlers;
using AuctionServer.Modules.Casino.Domain.Enums;
using AuctionServer.Modules.Casino.Infrastructure.Persistence;
using AuctionServer.Shared.Integration.Events.Casino;
using Microsoft.EntityFrameworkCore;

namespace AuctionServer.Modules.Casino.Tests.IntegrationTests;

[Collection(CasinoIntegrationCollection.Name)]
public class CasinoChipPurchaseRejectedEventHandlerTests(CasinoPostgresFixture fixture)
{
    private async Task HandleAsync(CasinoChipPurchaseRejectedEvent notification)
    {
        await using var context = fixture.CreateContext();
        var handler = new CasinoChipPurchaseRejectedEventHandler(new CasinoRepository(context));
        await handler.Handle(notification, CancellationToken.None);
    }

    [Fact]
    public async Task Handle_WhenPending_ShouldRejectWithReason()
    {
        var account = await fixture.SeedAccountAsync();
        var purchase = await fixture.SeedPurchaseAsync(account.UserId);
        var notification = new CasinoChipPurchaseRejectedEvent(
            Guid.NewGuid(), purchase.PublicPurchaseId, account.UserId, "Not enough funds on account");

        await HandleAsync(notification);

        var updatedPurchase = await fixture.GetPurchaseAsync(purchase.PublicPurchaseId);
        Assert.Equal(ChipPurchaseStatus.Rejected, updatedPurchase.Status);
        Assert.Equal("Not enough funds on account", updatedPurchase.RejectionReason);
        var updatedAccount = await fixture.GetAccountAsync(account.UserId);
        Assert.Equal(0m, updatedAccount.Balance);

        await using var context = fixture.CreateContext();
        Assert.True(await context.ProcessedMessages.AnyAsync(m => m.EventId == notification.EventId));
    }

    [Fact]
    public async Task Handle_WhenExpired_ShouldKeepExpiredStatusAndWriteInbox()
    {
        var account = await fixture.SeedAccountAsync();
        var purchase = await fixture.SeedPurchaseAsync(account.UserId, status: ChipPurchaseStatus.Expired);
        var notification = new CasinoChipPurchaseRejectedEvent(
            Guid.NewGuid(), purchase.PublicPurchaseId, account.UserId, "Not enough funds on account");

        await HandleAsync(notification);

        var updatedPurchase = await fixture.GetPurchaseAsync(purchase.PublicPurchaseId);
        Assert.Equal(ChipPurchaseStatus.Expired, updatedPurchase.Status);
        Assert.Equal("Purchase timed out", updatedPurchase.RejectionReason);

        await using var context = fixture.CreateContext();
        Assert.True(await context.ProcessedMessages.AnyAsync(m => m.EventId == notification.EventId));
    }
}

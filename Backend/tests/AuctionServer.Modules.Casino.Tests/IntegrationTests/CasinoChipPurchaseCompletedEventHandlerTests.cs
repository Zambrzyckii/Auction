using AuctionServer.Modules.Casino.Application.Handlers;
using AuctionServer.Modules.Casino.Domain.Enums;
using AuctionServer.Modules.Casino.Infrastructure.Persistence;
using AuctionServer.Shared.Integration.Events.Casino;
using Microsoft.EntityFrameworkCore;

namespace AuctionServer.Modules.Casino.Tests.IntegrationTests;

[Collection(CasinoIntegrationCollection.Name)]
public class CasinoChipPurchaseCompletedEventHandlerTests(CasinoPostgresFixture fixture)
{
    private async Task HandleAsync(CasinoChipPurchaseCompletedEvent notification)
    {
        await using var context = fixture.CreateContext();
        var handler = new CasinoChipPurchaseCompletedEventHandler(new CasinoRepository(context));
        await handler.Handle(notification, CancellationToken.None);
    }

    [Fact]
    public async Task Handle_WhenPending_ShouldCompletePurchaseAndCreditChips()
    {
        var account = await fixture.SeedAccountAsync();
        var purchase = await fixture.SeedPurchaseAsync(account.UserId, 500m);
        var notification = new CasinoChipPurchaseCompletedEvent(Guid.NewGuid(), purchase.PublicPurchaseId, account.UserId);

        await HandleAsync(notification);

        var updatedPurchase = await fixture.GetPurchaseAsync(purchase.PublicPurchaseId);
        Assert.Equal(ChipPurchaseStatus.Completed, updatedPurchase.Status);
        var updatedAccount = await fixture.GetAccountAsync(account.UserId);
        Assert.Equal(500m, updatedAccount.Balance);
        Assert.Equal(500m, updatedAccount.LifetimeBought);

        await using var context = fixture.CreateContext();
        Assert.True(await context.ProcessedMessages.AnyAsync(m => m.EventId == notification.EventId));
    }

    [Fact]
    public async Task Handle_WhenExpired_ShouldStillCreditChips()
    {
        var account = await fixture.SeedAccountAsync();
        var purchase = await fixture.SeedPurchaseAsync(account.UserId, 500m, ChipPurchaseStatus.Expired);

        await HandleAsync(new CasinoChipPurchaseCompletedEvent(Guid.NewGuid(), purchase.PublicPurchaseId, account.UserId));

        var updatedPurchase = await fixture.GetPurchaseAsync(purchase.PublicPurchaseId);
        Assert.Equal(ChipPurchaseStatus.Completed, updatedPurchase.Status);
        Assert.Null(updatedPurchase.RejectionReason);
        var updatedAccount = await fixture.GetAccountAsync(account.UserId);
        Assert.Equal(500m, updatedAccount.Balance);
    }

    [Fact]
    public async Task Handle_WhenDeliveredTwice_ShouldCreditOnce()
    {
        var account = await fixture.SeedAccountAsync();
        var purchase = await fixture.SeedPurchaseAsync(account.UserId, 500m);
        var notification = new CasinoChipPurchaseCompletedEvent(Guid.NewGuid(), purchase.PublicPurchaseId, account.UserId);

        await HandleAsync(notification);
        await HandleAsync(notification);

        var updatedAccount = await fixture.GetAccountAsync(account.UserId);
        Assert.Equal(500m, updatedAccount.Balance);
    }
}

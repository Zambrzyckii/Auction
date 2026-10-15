using AuctionServer.Modules.Pawnshop.Application.Handlers;
using AuctionServer.Modules.Pawnshop.Domain.Enums;
using AuctionServer.Modules.Pawnshop.Infrastructure.Persistence;
using AuctionServer.Shared.Integration.Events.Pawnshop;
using Microsoft.EntityFrameworkCore;

namespace AuctionServer.Modules.Pawnshop.Tests.IntegrationTests;

[Collection(PawnshopIntegrationCollection.Name)]
public class PawnshopPaymentRejectedEventHandlerTests(PawnshopPostgresFixture fixture)
{
    private async Task HandleAsync(PawnshopPaymentRejectedEvent notification)
    {
        await using var context = fixture.CreateContext();
        var handler = new PawnshopPaymentRejectedEventHandler(new PawnshopRepository(context));
        await handler.Handle(notification, CancellationToken.None);
    }

    [Fact]
    public async Task Handle_WhenPaymentPending_ShouldRejectWithReason()
    {
        var seeded = await fixture.SeedShopAsync();
        var notification = new PawnshopPaymentRejectedEvent(Guid.NewGuid(), seeded.PublicPawnshopId,
            seeded.PendingPaymentId!.Value, seeded.UserId, "Insufficient turnover");

        await HandleAsync(notification);

        var shop = await fixture.GetShopAsync(seeded.PublicPawnshopId);
        Assert.Equal(ShopStatus.Rejected, shop.Status);
        Assert.Equal("Insufficient turnover", shop.RejectionReason);
        await using var context = fixture.CreateContext();
        Assert.True(await context.ProcessedMessages.AnyAsync(m => m.EventId == notification.EventId));
    }

    [Fact]
    public async Task Handle_WhenBotPending_ShouldKeepShopActiveWithReason()
    {
        var seeded = await fixture.SeedShopAsync(ShopStatus.Active);
        var paymentId = await fixture.BeginBotPurchaseAsync(seeded.PublicPawnshopId);
        var notification = new PawnshopPaymentRejectedEvent(Guid.NewGuid(), seeded.PublicPawnshopId,
            paymentId, seeded.UserId, "Insufficient funds");

        await HandleAsync(notification);

        var shop = await fixture.GetShopAsync(seeded.PublicPawnshopId);
        Assert.Equal(ShopStatus.Active, shop.Status);
        Assert.Equal("Insufficient funds", shop.RejectionReason);
        Assert.Null(shop.BotTierName);
        Assert.Null(shop.PendingBotTierName);
    }

    [Fact]
    public async Task Handle_WhenDeliveredTwice_ShouldApplyOnce()
    {
        var seeded = await fixture.SeedShopAsync();
        var notification = new PawnshopPaymentRejectedEvent(Guid.NewGuid(), seeded.PublicPawnshopId,
            seeded.PendingPaymentId!.Value, seeded.UserId, "Insufficient turnover");

        await HandleAsync(notification);
        await HandleAsync(notification);

        await using var context = fixture.CreateContext();
        Assert.Equal(1, await context.ProcessedMessages.CountAsync(m => m.EventId == notification.EventId));
    }
}

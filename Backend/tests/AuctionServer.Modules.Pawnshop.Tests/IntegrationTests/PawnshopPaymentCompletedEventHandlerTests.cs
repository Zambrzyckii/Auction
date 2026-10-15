using AuctionServer.Modules.Pawnshop.Application.Handlers;
using AuctionServer.Modules.Pawnshop.Domain.Enums;
using AuctionServer.Modules.Pawnshop.Domain.Exceptions;
using AuctionServer.Modules.Pawnshop.Infrastructure.Persistence;
using AuctionServer.Shared.Integration.Events.Pawnshop;
using Microsoft.EntityFrameworkCore;

namespace AuctionServer.Modules.Pawnshop.Tests.IntegrationTests;

[Collection(PawnshopIntegrationCollection.Name)]
public class PawnshopPaymentCompletedEventHandlerTests(PawnshopPostgresFixture fixture)
{
    private async Task HandleAsync(PawnshopPaymentCompletedEvent notification)
    {
        await using var context = fixture.CreateContext();
        var handler = new PawnshopPaymentCompletedEventHandler(new PawnshopRepository(context));
        await handler.Handle(notification, CancellationToken.None);
    }

    [Fact]
    public async Task Handle_WhenPaymentPending_ShouldActivateShop()
    {
        var seeded = await fixture.SeedShopAsync();
        var notification = new PawnshopPaymentCompletedEvent(Guid.NewGuid(), seeded.PublicPawnshopId,
            seeded.PendingPaymentId!.Value, seeded.UserId);

        await HandleAsync(notification);

        var shop = await fixture.GetShopAsync(seeded.PublicPawnshopId);
        Assert.Equal(ShopStatus.Active, shop.Status);
        Assert.NotNull(shop.ActivatedOn);
        Assert.Null(shop.PendingPaymentId);
        await using var context = fixture.CreateContext();
        Assert.True(await context.ProcessedMessages.AnyAsync(m => m.EventId == notification.EventId));
    }

    [Fact]
    public async Task Handle_WhenBotPending_ShouldInstallBot()
    {
        var seeded = await fixture.SeedShopAsync(ShopStatus.Active);
        var paymentId = await fixture.BeginBotPurchaseAsync(seeded.PublicPawnshopId);
        var notification = new PawnshopPaymentCompletedEvent(Guid.NewGuid(), seeded.PublicPawnshopId,
            paymentId, seeded.UserId);

        await HandleAsync(notification);

        var shop = await fixture.GetShopAsync(seeded.PublicPawnshopId);
        Assert.Equal(ShopStatus.Active, shop.Status);
        Assert.Equal("Pawn Clerk", shop.BotTierName);
        Assert.Equal(PawnshopRarity.Common, shop.BotRarity);
        Assert.NotNull(shop.NextSpawnOn);
        Assert.Null(shop.PendingBotTierName);
        Assert.Null(shop.PendingPaymentId);
    }

    [Fact]
    public async Task Handle_WhenDeliveredTwice_ShouldActivateOnce()
    {
        var seeded = await fixture.SeedShopAsync();
        var notification = new PawnshopPaymentCompletedEvent(Guid.NewGuid(), seeded.PublicPawnshopId,
            seeded.PendingPaymentId!.Value, seeded.UserId);

        await HandleAsync(notification);
        await HandleAsync(notification);

        var shop = await fixture.GetShopAsync(seeded.PublicPawnshopId);
        Assert.Equal(ShopStatus.Active, shop.Status);
        await using var context = fixture.CreateContext();
        Assert.Equal(1, await context.ProcessedMessages.CountAsync(m => m.EventId == notification.EventId));
    }

    [Fact]
    public async Task Handle_WhenPaymentExpired_ShouldThrowWithoutInboxRow()
    {
        var seeded = await fixture.SeedShopAsync();
        var stalePaymentId = seeded.PendingPaymentId!.Value;
        await using (var setup = fixture.CreateContext())
        {
            var tracked = await setup.Shops.SingleAsync(s => s.PublicPawnshopId == seeded.PublicPawnshopId);
            tracked.ExpirePayment();
            await setup.SaveChangesAsync();
        }

        var notification = new PawnshopPaymentCompletedEvent(Guid.NewGuid(), seeded.PublicPawnshopId,
            stalePaymentId, seeded.UserId);

        await Assert.ThrowsAsync<PawnshopExceptions.InvalidShopStateTransitionException>(
            () => HandleAsync(notification));

        var shop = await fixture.GetShopAsync(seeded.PublicPawnshopId);
        Assert.Equal(ShopStatus.Rejected, shop.Status);
        await using var context = fixture.CreateContext();
        Assert.False(await context.ProcessedMessages.AnyAsync(m => m.EventId == notification.EventId));
    }
}

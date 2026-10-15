using System.Text.Json;
using AuctionServer.Modules.Pawnshop.Application.Command.BuyBot;
using AuctionServer.Modules.Pawnshop.Application.Options;
using AuctionServer.Modules.Pawnshop.Domain.Entities;
using AuctionServer.Modules.Pawnshop.Domain.Enums;
using AuctionServer.Modules.Pawnshop.Domain.Exceptions;
using AuctionServer.Modules.Pawnshop.Infrastructure.Outbox;
using AuctionServer.Modules.Pawnshop.Infrastructure.Persistence;
using AuctionServer.Shared.Integration.Events.Pawnshop;
using Microsoft.EntityFrameworkCore;

namespace AuctionServer.Modules.Pawnshop.Tests.IntegrationTests;

[Collection(PawnshopIntegrationCollection.Name)]
public class BuyBotCommandTests(PawnshopPostgresFixture fixture)
{
    private static readonly PawnshopOptions Options = new(100000m, 1000000m, TimeSpan.FromMinutes(5),
        TimeSpan.FromMinutes(15), TimeSpan.FromMinutes(15),
        [
            new BotTierDefinition("Pawn Clerk", PawnshopRarity.Common, 50000m, TimeSpan.FromSeconds(30), 0.5m),
            new BotTierDefinition("Appraiser", PawnshopRarity.Rare, 300000m, TimeSpan.FromMinutes(1), 0.5m)
        ]);

    private async Task HandleAsync(BuyBotCommand command)
    {
        await using var context = fixture.CreateContext();
        var handler = new BuyBotCommandHandler(new PawnshopRepository(context), Options);
        await handler.Handle(command, CancellationToken.None);
    }

    [Fact]
    public async Task Handle_ShouldRecordPendingBotAndEmitPaymentRequest()
    {
        var seeded = await fixture.SeedShopAsync(ShopStatus.Active);

        await HandleAsync(new BuyBotCommand(seeded.UserId, "Pawn Clerk"));

        var shop = await fixture.GetShopAsync(seeded.PublicPawnshopId);
        Assert.Equal("Pawn Clerk", shop.PendingBotTierName);
        Assert.NotNull(shop.PendingPaymentId);
        Assert.Null(shop.BotTierName);

        var paymentIdText = shop.PendingPaymentId.ToString()!;
        await using var context = fixture.CreateContext();
        var outboxMessage = await context.OutboxMessages
            .SingleAsync(m => m.Type == nameof(PawnshopPaymentRequestedEvent) && m.Content.Contains(paymentIdText));
        var requested = JsonSerializer.Deserialize<PawnshopPaymentRequestedEvent>(outboxMessage.Content);
        Assert.NotNull(requested);
        Assert.Equal(outboxMessage.Id, requested.EventId);
        Assert.Equal(50000m, requested.Amount);
        Assert.Equal(0m, requested.RequiredTurnover);
    }

    [Fact]
    public async Task Handle_WhenTierUnknown_ShouldThrowBeforeShopLookup()
    {
        await Assert.ThrowsAsync<PawnshopExceptions.BotTierNotFoundException>(
            () => HandleAsync(new BuyBotCommand(Guid.NewGuid(), "Phantom")));
    }

    [Fact]
    public async Task Handle_WhenOnlyRejectedShopExists_ShouldThrowNotFound()
    {
        var seeded = await fixture.SeedShopAsync(ShopStatus.Rejected);

        await Assert.ThrowsAsync<PawnshopExceptions.PawnshopNotFoundException>(
            () => HandleAsync(new BuyBotCommand(seeded.UserId, "Pawn Clerk")));
    }

    [Fact]
    public async Task Handle_WhenTwoPurchasesRace_ShouldLetExactlyOneWin()
    {
        var seeded = await fixture.SeedShopAsync(ShopStatus.Active);
        var now = DateTime.UtcNow;

        await using var context1 = fixture.CreateContext();
        await using var context2 = fixture.CreateContext();
        var repository1 = new PawnshopRepository(context1);
        var repository2 = new PawnshopRepository(context2);
        var shop1 = await repository1.GetLiveShopByUserIdAsync(seeded.UserId, CancellationToken.None);
        var shop2 = await repository2.GetLiveShopByUserIdAsync(seeded.UserId, CancellationToken.None);

        var payment1 = shop1.BeginBotPurchase("Pawn Clerk", PawnshopRarity.Common, TimeSpan.FromSeconds(30), 0.5m, now);
        var payment2 = shop2.BeginBotPurchase("Appraiser", PawnshopRarity.Rare, TimeSpan.FromMinutes(1), 0.5m, now);
        await repository1.SaveChangesWithOutboxAsync(BuildRequest(shop1, payment1, 50000m), CancellationToken.None);

        await Assert.ThrowsAsync<DbUpdateConcurrencyException>(
            () => repository2.SaveChangesWithOutboxAsync(BuildRequest(shop2, payment2, 300000m), CancellationToken.None));

        await using var context = fixture.CreateContext();
        Assert.Equal(1, await context.OutboxMessages.CountAsync(
            m => m.Type == nameof(PawnshopPaymentRequestedEvent)
                 && m.Content.Contains(seeded.PublicPawnshopId.ToString())));
    }

    private static OutboxMessage BuildRequest(Shop shop, Guid paymentId, decimal amount)
    {
        var eventId = Guid.NewGuid();
        return new OutboxMessage
        {
            Id = eventId,
            Type = nameof(PawnshopPaymentRequestedEvent),
            Content = JsonSerializer.Serialize(new PawnshopPaymentRequestedEvent(
                eventId, shop.PublicPawnshopId, paymentId, shop.UserId, amount, 0m))
        };
    }
}

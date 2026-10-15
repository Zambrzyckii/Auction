using System.Text.Json;
using AuctionServer.Modules.Pawnshop.Application.Command.OpenPawnshop;
using AuctionServer.Modules.Pawnshop.Application.Options;
using AuctionServer.Modules.Pawnshop.Domain.Enums;
using AuctionServer.Modules.Pawnshop.Domain.Exceptions;
using AuctionServer.Modules.Pawnshop.Infrastructure.Persistence;
using AuctionServer.Shared.Integration.Events.Pawnshop;
using Microsoft.EntityFrameworkCore;

namespace AuctionServer.Modules.Pawnshop.Tests.IntegrationTests;

[Collection(PawnshopIntegrationCollection.Name)]
public class OpenPawnshopCommandTests(PawnshopPostgresFixture fixture)
{
    private static readonly PawnshopOptions Options = new(100000m, 1000000m, TimeSpan.FromMinutes(5),
        TimeSpan.FromMinutes(15), TimeSpan.FromMinutes(15),
        [new BotTierDefinition("Pawn Clerk", PawnshopRarity.Common, 50000m, TimeSpan.FromSeconds(30), 0.5m)]);

    private async Task<Guid> HandleAsync(OpenPawnshopCommand command)
    {
        await using var context = fixture.CreateContext();
        var handler = new OpenPawnshopCommandHandler(new PawnshopRepository(context), Options);
        return await handler.Handle(command, CancellationToken.None);
    }

    [Fact]
    public async Task Handle_ShouldPersistPendingShopAndEmitPaymentRequest()
    {
        var userId = Guid.NewGuid();

        var publicPawnshopId = await HandleAsync(new OpenPawnshopCommand(userId));

        var shop = await fixture.GetShopAsync(publicPawnshopId);
        Assert.Equal(ShopStatus.PendingPayment, shop.Status);
        Assert.NotNull(shop.PendingPaymentId);

        await using var context = fixture.CreateContext();
        var outboxMessage = await context.OutboxMessages
            .SingleAsync(m => m.Type == nameof(PawnshopPaymentRequestedEvent)
                              && m.Content.Contains(publicPawnshopId.ToString()));
        var requested = JsonSerializer.Deserialize<PawnshopPaymentRequestedEvent>(outboxMessage.Content);
        Assert.NotNull(requested);
        Assert.Equal(outboxMessage.Id, requested.EventId);
        Assert.Equal(shop.PendingPaymentId, requested.PaymentId);
        Assert.Equal(100000m, requested.Amount);
        Assert.Equal(1000000m, requested.RequiredTurnover);
    }

    [Fact]
    public async Task Handle_WhenLiveShopExists_ShouldThrowAlreadyOwned()
    {
        var seeded = await fixture.SeedShopAsync(ShopStatus.Active);

        await Assert.ThrowsAsync<PawnshopExceptions.PawnshopAlreadyOwnedException>(
            () => HandleAsync(new OpenPawnshopCommand(seeded.UserId)));
    }

    [Fact]
    public async Task Handle_AfterRejectedShop_ShouldAllowNewShop()
    {
        var seeded = await fixture.SeedShopAsync(ShopStatus.Rejected);

        var publicPawnshopId = await HandleAsync(new OpenPawnshopCommand(seeded.UserId));

        var shop = await fixture.GetShopAsync(publicPawnshopId);
        Assert.Equal(ShopStatus.PendingPayment, shop.Status);
    }
}

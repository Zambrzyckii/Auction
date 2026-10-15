using System.Text.Json;
using AuctionServer.Modules.Pawnshop.Application.Command.WithdrawStockItem;
using AuctionServer.Modules.Pawnshop.Domain.Enums;
using AuctionServer.Modules.Pawnshop.Domain.Exceptions;
using AuctionServer.Modules.Pawnshop.Infrastructure.Outbox;
using AuctionServer.Modules.Pawnshop.Infrastructure.Persistence;
using AuctionServer.Shared.Integration.Events.Pawnshop;
using Microsoft.EntityFrameworkCore;

namespace AuctionServer.Modules.Pawnshop.Tests.IntegrationTests;

[Collection(PawnshopIntegrationCollection.Name)]
public class WithdrawStockItemCommandTests(PawnshopPostgresFixture fixture)
{
    private async Task HandleAsync(WithdrawStockItemCommand command)
    {
        await using var context = fixture.CreateContext();
        var handler = new WithdrawStockItemCommandHandler(new PawnshopRepository(context));
        await handler.Handle(command, CancellationToken.None);
    }

    [Fact]
    public async Task Handle_WhenOwnerWithinWindow_ShouldWithdrawAndEmitEvent()
    {
        var seeded = await fixture.SeedStockItemAsync();

        await HandleAsync(new WithdrawStockItemCommand(seeded.UserId, seeded.PublicStockItemId));

        var item = await fixture.GetStockItemAsync(seeded.PublicStockItemId);
        Assert.Equal(StockItemStatus.Withdrawn, item.Status);
        Assert.NotNull(item.ResolvedOn);
        Assert.Null(item.PayoutAmount);

        await using var context = fixture.CreateContext();
        var outboxMessage = await context.OutboxMessages
            .SingleAsync(m => m.Type == nameof(PawnshopItemWithdrawnEvent)
                              && m.Content.Contains(seeded.PublicStockItemId.ToString()));
        var withdrawn = JsonSerializer.Deserialize<PawnshopItemWithdrawnEvent>(outboxMessage.Content);
        Assert.NotNull(withdrawn);
        Assert.Equal(outboxMessage.Id, withdrawn.EventId);
        Assert.Equal(seeded.PublicPawnshopId, withdrawn.PublicPawnshopId);
        Assert.Equal(seeded.UserId, withdrawn.UserId);
        Assert.Equal("Pawned Rare Good", withdrawn.Name);
        Assert.Equal("Rare", withdrawn.Rarity);
        Assert.Equal(437m, withdrawn.Price);
    }

    [Fact]
    public async Task Handle_WhenItemBelongsToAnotherUser_ShouldThrowNotFound()
    {
        var seeded = await fixture.SeedStockItemAsync();

        await Assert.ThrowsAsync<PawnshopExceptions.StockItemNotFoundException>(
            () => HandleAsync(new WithdrawStockItemCommand(Guid.NewGuid(), seeded.PublicStockItemId)));

        var item = await fixture.GetStockItemAsync(seeded.PublicStockItemId);
        Assert.Equal(StockItemStatus.InStock, item.Status);
    }

    [Fact]
    public async Task Handle_WhenForeignItemWindowIsClosed_ShouldStillThrowNotFound()
    {
        var seeded = await fixture.SeedStockItemAsync(sellAfter: DateTime.UtcNow.AddMinutes(-1));

        await Assert.ThrowsAsync<PawnshopExceptions.StockItemNotFoundException>(
            () => HandleAsync(new WithdrawStockItemCommand(Guid.NewGuid(), seeded.PublicStockItemId)));
    }

    [Fact]
    public async Task Handle_WhenItemUnknown_ShouldThrowNotFound()
    {
        await Assert.ThrowsAsync<PawnshopExceptions.StockItemNotFoundException>(
            () => HandleAsync(new WithdrawStockItemCommand(Guid.NewGuid(), Guid.NewGuid())));
    }

    [Fact]
    public async Task Handle_WhenWindowClosed_ShouldThrowWithoutEvent()
    {
        var seeded = await fixture.SeedStockItemAsync(sellAfter: DateTime.UtcNow.AddMinutes(-1));

        await Assert.ThrowsAsync<PawnshopExceptions.StockWindowClosedException>(
            () => HandleAsync(new WithdrawStockItemCommand(seeded.UserId, seeded.PublicStockItemId)));

        await using var context = fixture.CreateContext();
        Assert.False(await context.OutboxMessages.AnyAsync(m => m.Content.Contains(seeded.PublicStockItemId.ToString())));
    }

    [Fact]
    public async Task Handle_WhenWithdrawRacesSale_ShouldLetExactlyOneWin()
    {
        var seeded = await fixture.SeedStockItemAsync();

        await using var saleContext = fixture.CreateContext();
        var selling = await saleContext.StockItems.SingleAsync(i => i.PublicStockItemId == seeded.PublicStockItemId);
        var payout = selling.Sell(seeded.SellAfter);
        var eventId = Guid.NewGuid();
        saleContext.OutboxMessages.Add(new OutboxMessage
        {
            Id = eventId,
            Type = nameof(PawnshopPayoutEvent),
            Content = JsonSerializer.Serialize(new PawnshopPayoutEvent(
                eventId, seeded.PublicPawnshopId, seeded.UserId, payout))
        });

        await HandleAsync(new WithdrawStockItemCommand(seeded.UserId, seeded.PublicStockItemId));

        await Assert.ThrowsAsync<DbUpdateConcurrencyException>(() => saleContext.SaveChangesAsync());

        var item = await fixture.GetStockItemAsync(seeded.PublicStockItemId);
        Assert.Equal(StockItemStatus.Withdrawn, item.Status);
        Assert.Null(item.PayoutAmount);
        await using var context = fixture.CreateContext();
        Assert.Equal(1, await context.OutboxMessages.CountAsync(
            m => m.Content.Contains(seeded.PublicPawnshopId.ToString())));
    }
}

using System.Text.Json;
using AuctionServer.Modules.Casino.Application.Command.CashOutChips;
using AuctionServer.Modules.Casino.Domain.Exceptions;
using AuctionServer.Modules.Casino.Infrastructure.Persistence;
using AuctionServer.Shared.Integration.Events.Casino;
using Microsoft.EntityFrameworkCore;

namespace AuctionServer.Modules.Casino.Tests.IntegrationTests;

[Collection(CasinoIntegrationCollection.Name)]
public class CashOutChipsCommandTests(CasinoPostgresFixture fixture)
{
    private async Task HandleAsync(CashOutChipsCommand command)
    {
        await using var context = fixture.CreateContext();
        var handler = new CashOutChipsCommandHandler(new CasinoRepository(context));
        await handler.Handle(command, CancellationToken.None);
    }

    [Fact]
    public async Task Handle_WithHalfChips_ShouldDebitAndEmitCashOut()
    {
        var account = await fixture.SeedAccountAsync(500m);

        await HandleAsync(new CashOutChipsCommand(account.UserId, 487.5m));

        var updated = await fixture.GetAccountAsync(account.UserId);
        Assert.Equal(12.5m, updated.Balance);
        Assert.Equal(487.5m, updated.LifetimeCashedOut);

        await using var context = fixture.CreateContext();
        var outboxMessage = await context.OutboxMessages
            .SingleAsync(m => m.Type == nameof(CasinoCashOutEvent)
                              && m.Content.Contains(account.UserId.ToString()));
        var cashOut = JsonSerializer.Deserialize<CasinoCashOutEvent>(outboxMessage.Content);
        Assert.NotNull(cashOut);
        Assert.Equal(outboxMessage.Id, cashOut.EventId);
        Assert.Equal(487.5m, cashOut.Amount);
    }

    [Fact]
    public async Task Handle_WhenMoreThanBalance_ShouldThrowWithoutOutbox()
    {
        var account = await fixture.SeedAccountAsync(500m);

        await Assert.ThrowsAsync<CasinoExceptions.InsufficientChipsException>(
            () => HandleAsync(new CashOutChipsCommand(account.UserId, 500.01m)));

        await using var context = fixture.CreateContext();
        Assert.False(await context.OutboxMessages.AnyAsync(m => m.Content.Contains(account.UserId.ToString())));
    }

    [Fact]
    public async Task Handle_WhenNoAccount_ShouldThrowNotFound() =>
        await Assert.ThrowsAsync<CasinoExceptions.ChipAccountNotFoundException>(
            () => HandleAsync(new CashOutChipsCommand(Guid.NewGuid(), 10m)));
}

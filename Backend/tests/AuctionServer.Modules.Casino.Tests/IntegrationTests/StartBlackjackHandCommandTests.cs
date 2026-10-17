using System.Text.Json;
using AuctionServer.Modules.Casino.Application.Command.StartBlackjackHand;
using AuctionServer.Modules.Casino.Application.Options;
using AuctionServer.Modules.Casino.Domain.Enums;
using AuctionServer.Modules.Casino.Domain.Exceptions;
using AuctionServer.Modules.Casino.Infrastructure.Persistence;
using AuctionServer.Modules.Casino.Tests.Domain.Cards;
using Microsoft.EntityFrameworkCore;

namespace AuctionServer.Modules.Casino.Tests.IntegrationTests;

[Collection(CasinoIntegrationCollection.Name)]
public class StartBlackjackHandCommandTests(CasinoPostgresFixture fixture)
{
    private static readonly CasinoOptions Options = new(TimeSpan.FromMinutes(15),
        new RouletteOptions(1m, 1000m, 20),
        new BlackjackOptions(5m, 2000m, TimeSpan.FromMinutes(5)));

    private async Task<BlackjackHandDto> HandleAsync(StartBlackjackHandCommand command, ScriptedCardSource source)
    {
        await using var context = fixture.CreateContext();
        var handler = new StartBlackjackHandCommandHandler(new CasinoRepository(context), source, Options);
        return await handler.Handle(command, CancellationToken.None);
    }

    [Fact]
    public async Task Handle_ShouldDebitStakeAndPersistInProgressHand()
    {
        var account = await fixture.SeedAccountAsync(500m);

        var dto = await HandleAsync(new StartBlackjackHandCommand(account.UserId, 100m),
            new ScriptedCardSource("5H", "10S", "6D", "7C"));

        Assert.Equal(BlackjackHandStatus.InProgress, dto.Status);
        Assert.Equal(400m, dto.Balance);

        var hand = await fixture.GetHandAsync(dto.PublicHandId);
        Assert.Equal(BlackjackHandStatus.InProgress, hand.Status);
        var updatedAccount = await fixture.GetAccountAsync(account.UserId);
        Assert.Equal(400m, updatedAccount.Balance);
    }

    [Fact]
    public async Task Handle_PlayerNatural_ShouldCreditPayoutImmediately()
    {
        var account = await fixture.SeedAccountAsync(500m);

        var dto = await HandleAsync(new StartBlackjackHandCommand(account.UserId, 100m),
            new ScriptedCardSource("AS", "5H", "KD", "9C"));

        Assert.Equal(BlackjackOutcome.Blackjack, dto.Outcome);
        Assert.Equal(650m, dto.Balance);
        var updatedAccount = await fixture.GetAccountAsync(account.UserId);
        Assert.Equal(650m, updatedAccount.Balance);
    }

    [Fact]
    public async Task Handle_WhenHandInFlight_ShouldThrowHandInProgress()
    {
        var account = await fixture.SeedAccountAsync(500m);
        await fixture.SeedHandAsync(account.UserId);

        await Assert.ThrowsAsync<CasinoExceptions.HandInProgressException>(
            () => HandleAsync(new StartBlackjackHandCommand(account.UserId, 100m),
                new ScriptedCardSource("5H", "10S", "6D", "7C")));
    }

    [Theory]
    [InlineData(4)]
    [InlineData(3000)]
    public async Task Handle_WhenStakeOutsideTableLimits_ShouldThrow(decimal stake)
    {
        var account = await fixture.SeedAccountAsync(5000m);

        await Assert.ThrowsAsync<CasinoExceptions.InvalidBlackjackStakeException>(
            () => HandleAsync(new StartBlackjackHandCommand(account.UserId, stake),
                new ScriptedCardSource("5H", "10S", "6D", "7C")));
    }

    [Fact]
    public async Task Handle_WhenChipsInsufficient_ShouldThrowWithoutHandRow()
    {
        var account = await fixture.SeedAccountAsync(50m);

        await Assert.ThrowsAsync<CasinoExceptions.InsufficientChipsException>(
            () => HandleAsync(new StartBlackjackHandCommand(account.UserId, 100m),
                new ScriptedCardSource("5H", "10S", "6D", "7C")));

        await using var context = fixture.CreateContext();
        Assert.False(await context.BlackjackHands.AnyAsync(h => h.UserId == account.UserId));
    }

    [Fact]
    public async Task Handle_ResponseJson_ShouldNotLeakHoleCard()
    {
        var account = await fixture.SeedAccountAsync(500m);

        var dto = await HandleAsync(new StartBlackjackHandCommand(account.UserId, 100m),
            new ScriptedCardSource("5H", "10S", "6D", "7C"));

        using var json = JsonDocument.Parse(JsonSerializer.Serialize(dto));
        var properties = json.RootElement.EnumerateObject().Select(p => p.Name).ToList();
        Assert.DoesNotContain("DealerCards", properties);

        var visible = json.RootElement.GetProperty("VisibleDealerCards")
            .EnumerateArray().Select(e => e.GetInt32()).ToList();
        Assert.Equal([TestCards.Parse("10S").Code], visible);
        Assert.DoesNotContain(TestCards.Parse("7C").Code, visible);
    }
}

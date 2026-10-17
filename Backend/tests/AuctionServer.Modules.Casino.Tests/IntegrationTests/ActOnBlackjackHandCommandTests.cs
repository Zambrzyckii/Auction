using AuctionServer.Modules.Casino.Application.Command.ActOnBlackjackHand;
using AuctionServer.Modules.Casino.Application.Command.StartBlackjackHand;
using AuctionServer.Modules.Casino.Domain.Enums;
using AuctionServer.Modules.Casino.Domain.Exceptions;
using AuctionServer.Modules.Casino.Infrastructure.Persistence;
using AuctionServer.Modules.Casino.Tests.Domain.Cards;

namespace AuctionServer.Modules.Casino.Tests.IntegrationTests;

[Collection(CasinoIntegrationCollection.Name)]
public class ActOnBlackjackHandCommandTests(CasinoPostgresFixture fixture)
{
    private async Task<BlackjackHandDto> HandleAsync(ActOnBlackjackHandCommand command, ScriptedCardSource source)
    {
        await using var context = fixture.CreateContext();
        var handler = new ActOnBlackjackHandCommandHandler(new CasinoRepository(context), source);
        return await handler.Handle(command, CancellationToken.None);
    }

    [Fact]
    public async Task Handle_Hit_ShouldPersistDrawnCard()
    {
        var account = await fixture.SeedAccountAsync(400m);
        var hand = await fixture.SeedHandAsync(account.UserId);

        var dto = await HandleAsync(
            new ActOnBlackjackHandCommand(account.UserId, hand.PublicHandId, BlackjackAction.Hit),
            new ScriptedCardSource("2D"));

        Assert.Equal(3, dto.PlayerCards.Count);
        Assert.Equal(BlackjackHandStatus.InProgress, dto.Status);

        var updatedHand = await fixture.GetHandAsync(hand.PublicHandId);
        Assert.Equal(3, updatedHand.PlayerCards.Count);
    }

    [Fact]
    public async Task Handle_Stand_ShouldSettleAndCreditPayout()
    {
        var account = await fixture.SeedAccountAsync(400m);
        var hand = await fixture.SeedHandAsync(account.UserId, "10H", "10S", "9D", "6C");

        var dto = await HandleAsync(
            new ActOnBlackjackHandCommand(account.UserId, hand.PublicHandId, BlackjackAction.Stand),
            new ScriptedCardSource("AD"));

        Assert.Equal(BlackjackOutcome.Win, dto.Outcome);
        Assert.Equal(200m, dto.Payout);
        Assert.Equal(600m, dto.Balance);
        var updatedAccount = await fixture.GetAccountAsync(account.UserId);
        Assert.Equal(600m, updatedAccount.Balance);
    }

    [Fact]
    public async Task Handle_Double_ShouldDebitExtraStakeAndSettle()
    {
        var account = await fixture.SeedAccountAsync(400m);
        var hand = await fixture.SeedHandAsync(account.UserId, "6H", "10S", "5D", "7C");

        var dto = await HandleAsync(
            new ActOnBlackjackHandCommand(account.UserId, hand.PublicHandId, BlackjackAction.Double),
            new ScriptedCardSource("KD"));

        Assert.True(dto.Doubled);
        Assert.Equal(200m, dto.Stake);
        Assert.Equal(400m, dto.Payout);
        Assert.Equal(700m, dto.Balance);

        var updatedHand = await fixture.GetHandAsync(hand.PublicHandId);
        Assert.Equal(BlackjackHandStatus.Completed, updatedHand.Status);
        Assert.Equal(200m, updatedHand.Stake);
    }

    [Fact]
    public async Task Handle_ForeignHand_ShouldThrowNotFound()
    {
        var account = await fixture.SeedAccountAsync(400m);
        var hand = await fixture.SeedHandAsync(account.UserId);

        await Assert.ThrowsAsync<CasinoExceptions.HandNotFoundException>(
            () => HandleAsync(new ActOnBlackjackHandCommand(Guid.NewGuid(), hand.PublicHandId, BlackjackAction.Hit),
                new ScriptedCardSource("2D")));
    }

    [Fact]
    public async Task Handle_WhenHandCompleted_ShouldThrowInvalidAction()
    {
        var account = await fixture.SeedAccountAsync(400m);
        var hand = await fixture.SeedHandAsync(account.UserId, "AS", "5H", "KD", "9C");

        await Assert.ThrowsAsync<CasinoExceptions.InvalidBlackjackActionException>(
            () => HandleAsync(new ActOnBlackjackHandCommand(account.UserId, hand.PublicHandId, BlackjackAction.Hit),
                new ScriptedCardSource("2D")));
    }
}

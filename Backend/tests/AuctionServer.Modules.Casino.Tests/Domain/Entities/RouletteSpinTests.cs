using AuctionServer.Modules.Casino.Domain.Entities;
using AuctionServer.Modules.Casino.Domain.Enums;
using AuctionServer.Modules.Casino.Domain.Exceptions;

namespace AuctionServer.Modules.Casino.Tests.Domain.Entities;

public class RouletteSpinTests
{
    private static readonly DateTime Now = new(2026, 10, 16, 12, 0, 0, DateTimeKind.Utc);

    private static RouletteBet Bet(RouletteBetType type, short? selection = null, decimal stake = 100m) =>
        new() { Type = type, Selection = selection, Stake = stake };

    private static RouletteSpin Resolve(IReadOnlyList<RouletteBet> bets, int pocket) =>
        RouletteSpin.Resolve(Guid.NewGuid(), bets, pocket, 1m, 1000m, 20, Now);

    [Fact]
    public void Resolve_WinningAndLosingBets_ShouldSettleTotals()
    {
        var bets = new[] { Bet(RouletteBetType.Red), Bet(RouletteBetType.Straight, 17, 10m) };

        var spin = Resolve(bets, 32);

        Assert.Equal(32, spin.Pocket);
        Assert.Equal(110m, spin.TotalStake);
        Assert.Equal(200m, spin.TotalPayout);
        Assert.Equal(200m, bets[0].Payout);
        Assert.Equal(0m, bets[1].Payout);
        Assert.Equal(Now, spin.PlacedOn);
    }

    [Fact]
    public void Resolve_OnZeroWithHedgedColors_ShouldLoseBothBets()
    {
        var spin = Resolve([Bet(RouletteBetType.Red), Bet(RouletteBetType.Black)], 0);

        Assert.Equal(200m, spin.TotalStake);
        Assert.Equal(0m, spin.TotalPayout);
    }

    [Fact]
    public void Resolve_WhenNoBets_ShouldThrow() =>
        Assert.Throws<CasinoExceptions.InvalidRouletteBetsException>(() => Resolve([], 17));

    [Fact]
    public void Resolve_WhenTooManyBets_ShouldThrow()
    {
        var bets = Enumerable.Range(0, 21).Select(_ => Bet(RouletteBetType.Red)).ToList();

        Assert.Throws<CasinoExceptions.InvalidRouletteBetsException>(() => Resolve(bets, 17));
    }

    [Theory]
    [InlineData(0)]
    [InlineData(1500)]
    [InlineData(10.5)]
    public void Resolve_WhenStakeOutsideLimitsOrFractional_ShouldThrow(decimal stake) =>
        Assert.Throws<CasinoExceptions.InvalidRouletteBetsException>(
            () => Resolve([Bet(RouletteBetType.Red, stake: stake)], 17));

    [Theory]
    [InlineData(RouletteBetType.Straight, (short)37)]
    [InlineData(RouletteBetType.Straight, null)]
    [InlineData(RouletteBetType.Dozen, (short)4)]
    [InlineData(RouletteBetType.Column, null)]
    [InlineData(RouletteBetType.Red, (short)1)]
    public void Resolve_WhenSelectionDoesNotMatchType_ShouldThrow(RouletteBetType type, short? selection) =>
        Assert.Throws<CasinoExceptions.InvalidRouletteBetsException>(
            () => Resolve([Bet(type, selection)], 17));

    [Theory]
    [InlineData(0, "Green")]
    [InlineData(32, "Red")]
    [InlineData(33, "Black")]
    public void ColorOf_ShouldNameThePocket(int pocket, string expected) =>
        Assert.Equal(expected, RouletteSpin.ColorOf(pocket));
}

using AuctionServer.Modules.Casino.Domain.Entities;
using AuctionServer.Modules.Casino.Domain.Enums;

namespace AuctionServer.Modules.Casino.Tests.Domain.Entities;

public class RouletteBetTests
{
    private static RouletteBet Bet(RouletteBetType type, short? selection = null) =>
        new() { Type = type, Selection = selection, Stake = 100m };

    public static TheoryData<RouletteBetType, short?, int> BetCoverage => new()
    {
        { RouletteBetType.Straight, (short)17, 1 },
        { RouletteBetType.Straight, (short)0, 1 },
        { RouletteBetType.Red, null, 18 },
        { RouletteBetType.Black, null, 18 },
        { RouletteBetType.Odd, null, 18 },
        { RouletteBetType.Even, null, 18 },
        { RouletteBetType.Low, null, 18 },
        { RouletteBetType.High, null, 18 },
        { RouletteBetType.Dozen, (short)1, 12 },
        { RouletteBetType.Dozen, (short)2, 12 },
        { RouletteBetType.Dozen, (short)3, 12 },
        { RouletteBetType.Column, (short)1, 12 },
        { RouletteBetType.Column, (short)2, 12 },
        { RouletteBetType.Column, (short)3, 12 }
    };

    [Theory]
    [MemberData(nameof(BetCoverage))]
    public void Covers_AcrossAllPockets_ShouldMatchCoverCount(RouletteBetType type, short? selection, int expectedCount)
    {
        var bet = Bet(type, selection);

        var covered = Enumerable.Range(0, 37).Count(bet.Covers);

        Assert.Equal(expectedCount, covered);
        Assert.Equal(expectedCount, bet.CoverCount);
    }

    [Theory]
    [MemberData(nameof(BetCoverage))]
    public void PayoutFor_AcrossAllPockets_ShouldReturnExactlyThirtySixStakes(
        RouletteBetType type, short? selection, int expectedCount)
    {
        _ = expectedCount;
        var bet = Bet(type, selection);

        var total = Enumerable.Range(0, 37).Sum(bet.PayoutFor);

        Assert.Equal(3600m, total);
    }

    [Theory]
    [InlineData(RouletteBetType.Red)]
    [InlineData(RouletteBetType.Black)]
    [InlineData(RouletteBetType.Odd)]
    [InlineData(RouletteBetType.Even)]
    [InlineData(RouletteBetType.Low)]
    [InlineData(RouletteBetType.High)]
    public void Covers_OnZero_ShouldLoseEveryEvenMoneyBet(RouletteBetType type) =>
        Assert.False(Bet(type).Covers(0));

    [Theory]
    [InlineData(1)]
    [InlineData(2)]
    [InlineData(3)]
    public void Covers_OnZero_ShouldLoseDozensAndColumns(short selection)
    {
        Assert.False(Bet(RouletteBetType.Dozen, selection).Covers(0));
        Assert.False(Bet(RouletteBetType.Column, selection).Covers(0));
    }

    [Fact]
    public void Covers_StraightOnZero_ShouldWinOnZero()
    {
        var bet = Bet(RouletteBetType.Straight, 0);

        Assert.True(bet.Covers(0));
        Assert.Equal(3600m, bet.PayoutFor(0));
    }

    [Fact]
    public void PayoutFor_WinningBets_ShouldUseExactMultipliers()
    {
        Assert.Equal(200m, Bet(RouletteBetType.Red).PayoutFor(32));
        Assert.Equal(300m, Bet(RouletteBetType.Dozen, 2).PayoutFor(24));
        Assert.Equal(300m, Bet(RouletteBetType.Column, 3).PayoutFor(36));
        Assert.Equal(0m, Bet(RouletteBetType.High).PayoutFor(5));
    }
}

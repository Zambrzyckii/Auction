using AuctionServer.Modules.Casino.Domain.Entities;
using AuctionServer.Modules.Casino.Domain.Enums;
using AuctionServer.Modules.Casino.Domain.Exceptions;
using AuctionServer.Modules.Casino.Tests.Domain.Cards;

namespace AuctionServer.Modules.Casino.Tests.Domain.Entities;

public class BlackjackHandTests
{
    private static readonly DateTime Now = new(2026, 10, 16, 12, 0, 0, DateTimeKind.Utc);

    private static BlackjackHand Start(ScriptedCardSource source, decimal stake = 100m) =>
        BlackjackHand.Start(Guid.NewGuid(), stake, source, Now);

    [Fact]
    public void Start_ShouldDealTwoCardsEachAndHideHoleCard()
    {
        var hand = Start(new ScriptedCardSource("5H", "10S", "6D", "7C"));

        Assert.Equal(BlackjackHandStatus.InProgress, hand.Status);
        Assert.Equal(2, hand.PlayerCards.Count);
        Assert.Equal(2, hand.DealerCards.Count);
        Assert.Single(hand.VisibleDealerCards);
        Assert.Equal(TestCards.Parse("10S").Code, hand.VisibleDealerCards[0]);
        Assert.Equal(11, hand.PlayerValue.Total);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-5)]
    [InlineData(10.5)]
    public void Start_WhenStakeIsNotPositiveWhole_ShouldThrow(decimal stake) =>
        Assert.Throws<CasinoExceptions.InvalidChipAmountException>(
            () => BlackjackHand.Start(Guid.NewGuid(), stake, new ScriptedCardSource("5H", "10S", "6D", "7C"), Now));

    [Fact]
    public void Start_PlayerNatural_ShouldPayThreeToTwoImmediately()
    {
        var hand = Start(new ScriptedCardSource("AS", "5H", "KD", "9C"));

        Assert.Equal(BlackjackHandStatus.Completed, hand.Status);
        Assert.Equal(BlackjackOutcome.Blackjack, hand.Outcome);
        Assert.Equal(250m, hand.Payout);
        Assert.Equal(2, hand.VisibleDealerCards.Count);
    }

    [Fact]
    public void Start_BothNaturals_ShouldPush()
    {
        var hand = Start(new ScriptedCardSource("AS", "AD", "KD", "KC"));

        Assert.Equal(BlackjackOutcome.Push, hand.Outcome);
        Assert.Equal(100m, hand.Payout);
    }

    [Fact]
    public void Start_DealerPeekFindsNatural_ShouldEndHandImmediately()
    {
        var hand = Start(new ScriptedCardSource("5H", "AD", "6D", "KC"));

        Assert.Equal(BlackjackHandStatus.Completed, hand.Status);
        Assert.Equal(BlackjackOutcome.Lose, hand.Outcome);
        Assert.Equal(0m, hand.Payout);
    }

    [Fact]
    public void Start_DealerTenUpWithoutNatural_ShouldKeepPlaying()
    {
        var hand = Start(new ScriptedCardSource("5H", "10S", "6D", "7C"));

        Assert.Equal(BlackjackHandStatus.InProgress, hand.Status);
    }

    [Fact]
    public void Hit_ShouldDrawCardAndStayInProgress()
    {
        var source = new ScriptedCardSource("5H", "10S", "6D", "7C", "2D");
        var hand = Start(source);
        var versionBefore = hand.Version;

        hand.Hit(source, Now.AddSeconds(5));

        Assert.Equal(BlackjackHandStatus.InProgress, hand.Status);
        Assert.Equal(13, hand.PlayerValue.Total);
        Assert.Equal(Now.AddSeconds(5), hand.LastActionOn);
        Assert.NotEqual(versionBefore, hand.Version);
    }

    [Fact]
    public void Hit_WhenBust_ShouldLoseWithoutDealerPlay()
    {
        var source = new ScriptedCardSource("10H", "5S", "6D", "7C", "KD");
        var hand = Start(source);

        hand.Hit(source, Now);

        Assert.Equal(BlackjackOutcome.Lose, hand.Outcome);
        Assert.Equal(0m, hand.Payout);
        Assert.Equal(2, hand.DealerCards.Count);
    }

    [Fact]
    public void Hit_ToTwentyOne_ShouldAutoStandAndPlayDealer()
    {
        var source = new ScriptedCardSource("10H", "5S", "5D", "7C", "6D", "KD");
        var hand = Start(source);

        hand.Hit(source, Now);

        Assert.Equal(BlackjackOutcome.Win, hand.Outcome);
        Assert.Equal(200m, hand.Payout);
        Assert.Equal(3, hand.DealerCards.Count);
    }

    [Fact]
    public void Stand_DealerDrawsOnHardSixteenToSeventeen()
    {
        var source = new ScriptedCardSource("10H", "10S", "9D", "6C", "AD");
        var hand = Start(source);

        hand.Stand(source, Now);

        Assert.Equal(BlackjackOutcome.Win, hand.Outcome);
        Assert.Equal(200m, hand.Payout);
        Assert.Equal(3, hand.DealerCards.Count);
    }

    [Fact]
    public void Stand_DealerStandsOnSoftSeventeen()
    {
        var source = new ScriptedCardSource("10H", "AS", "8D", "6C");
        var hand = Start(source);

        hand.Stand(source, Now);

        Assert.Equal(BlackjackOutcome.Win, hand.Outcome);
        Assert.Equal(0, source.RemainingCards);
        Assert.Equal(2, hand.DealerCards.Count);
    }

    [Fact]
    public void Stand_EqualTotals_ShouldPush()
    {
        var source = new ScriptedCardSource("10H", "10S", "8D", "8C");
        var hand = Start(source);

        hand.Stand(source, Now);

        Assert.Equal(BlackjackOutcome.Push, hand.Outcome);
        Assert.Equal(100m, hand.Payout);
    }

    [Fact]
    public void Stand_DealerHigher_ShouldLose()
    {
        var source = new ScriptedCardSource("10H", "10S", "8D", "9C");
        var hand = Start(source);

        hand.Stand(source, Now);

        Assert.Equal(BlackjackOutcome.Lose, hand.Outcome);
        Assert.Equal(0m, hand.Payout);
    }

    [Fact]
    public void Double_ShouldDoubleStakeDealOneCardAndSettle()
    {
        var source = new ScriptedCardSource("6H", "10S", "5D", "7C", "KD");
        var hand = Start(source);

        hand.Double(source, Now);

        Assert.True(hand.Doubled);
        Assert.Equal(200m, hand.Stake);
        Assert.Equal(3, hand.PlayerCards.Count);
        Assert.Equal(BlackjackOutcome.Win, hand.Outcome);
        Assert.Equal(400m, hand.Payout);
    }

    [Fact]
    public void Double_WhenBust_ShouldLoseDoubledStake()
    {
        var source = new ScriptedCardSource("10H", "5S", "6D", "7C", "KD");
        var hand = Start(source);

        hand.Double(source, Now);

        Assert.Equal(BlackjackOutcome.Lose, hand.Outcome);
        Assert.Equal(200m, hand.Stake);
        Assert.Equal(0m, hand.Payout);
        Assert.Equal(2, hand.DealerCards.Count);
    }

    [Fact]
    public void Double_AfterHit_ShouldThrow()
    {
        var source = new ScriptedCardSource("5H", "10S", "6D", "7C", "2D");
        var hand = Start(source);
        hand.Hit(source, Now);

        Assert.Throws<CasinoExceptions.InvalidBlackjackActionException>(() => hand.Double(source, Now));
    }

    [Fact]
    public void Hit_WhenCompleted_ShouldThrow()
    {
        var source = new ScriptedCardSource("AS", "5H", "KD", "9C");
        var hand = Start(source);

        Assert.Throws<CasinoExceptions.InvalidBlackjackActionException>(() => hand.Hit(source, Now));
    }

    [Fact]
    public void AutoStand_ShouldFlagHandAndSettle()
    {
        var source = new ScriptedCardSource("10H", "10S", "9D", "6C", "5C");
        var hand = Start(source);

        hand.AutoStand(source, Now.AddMinutes(6));

        Assert.True(hand.AutoStood);
        Assert.Equal(BlackjackHandStatus.Completed, hand.Status);
        Assert.Equal(BlackjackOutcome.Lose, hand.Outcome);
        Assert.Equal(Now.AddMinutes(6), hand.CompletedOn);
    }
}

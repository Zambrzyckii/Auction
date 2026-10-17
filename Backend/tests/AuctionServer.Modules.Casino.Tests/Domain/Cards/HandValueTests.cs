using AuctionServer.Modules.Casino.Domain.Cards;

namespace AuctionServer.Modules.Casino.Tests.Domain.Cards;

public class HandValueTests
{
    [Theory]
    [InlineData(new[] { "2H", "3S" }, 5)]
    [InlineData(new[] { "10H", "9S" }, 19)]
    [InlineData(new[] { "KH", "QS", "2D" }, 22)]
    [InlineData(new[] { "7H", "8S", "6D" }, 21)]
    public void Of_HardHands_ShouldSumFaceValues(string[] cards, int expectedTotal)
    {
        var value = HandValue.Of(TestCards.Hand(cards));

        Assert.Equal(expectedTotal, value.Total);
        Assert.False(value.IsSoft);
    }

    [Theory]
    [InlineData(new[] { "AS", "6H" }, 17)]
    [InlineData(new[] { "AS", "KD" }, 21)]
    [InlineData(new[] { "AS", "AD" }, 12)]
    [InlineData(new[] { "AS", "AD", "9H" }, 21)]
    public void Of_SoftHands_ShouldCountOneAceAsEleven(string[] cards, int expectedTotal)
    {
        var value = HandValue.Of(TestCards.Hand(cards));

        Assert.Equal(expectedTotal, value.Total);
        Assert.True(value.IsSoft);
    }

    [Theory]
    [InlineData(new[] { "AS", "6H", "9D" }, 16)]
    [InlineData(new[] { "AS", "AD", "KH", "9C" }, 21)]
    [InlineData(new[] { "AS", "KD", "5H", "QC" }, 26)]
    public void Of_AcesForcedToOne_ShouldFallBackToHardTotal(string[] cards, int expectedTotal)
    {
        var value = HandValue.Of(TestCards.Hand(cards));

        Assert.Equal(expectedTotal, value.Total);
        Assert.False(value.IsSoft);
    }

    [Fact]
    public void IsBust_ShouldTriggerAboveTwentyOne()
    {
        Assert.True(HandValue.Of(TestCards.Hand("KH", "QS", "5D")).IsBust);
        Assert.False(HandValue.Of(TestCards.Hand("KH", "QS", "AD")).IsBust);
    }

    [Theory]
    [InlineData(new[] { "AS", "KD" }, true)]
    [InlineData(new[] { "AS", "10D" }, true)]
    [InlineData(new[] { "KH", "QS", "AD" }, false)]
    [InlineData(new[] { "10H", "9S" }, false)]
    public void IsBlackjack_ShouldRequireTwoCardTwentyOne(string[] cards, bool expected) =>
        Assert.Equal(expected, HandValue.IsBlackjack(TestCards.Hand(cards)));
}

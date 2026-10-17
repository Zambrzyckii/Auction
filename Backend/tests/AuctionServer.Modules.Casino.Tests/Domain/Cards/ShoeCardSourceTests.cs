using AuctionServer.Modules.Casino.Application.Interfaces;
using AuctionServer.Modules.Casino.Domain.Cards;
using AuctionServer.Modules.Casino.Infrastructure.Random;

namespace AuctionServer.Modules.Casino.Tests.Domain.Cards;

public class ShoeCardSourceTests
{
    private sealed class IndexRandom(int value) : ICasinoRandom
    {
        public int Next(int exclusiveMax)
        {
            Assert.InRange(value, 0, exclusiveMax - 1);
            return value;
        }
    }

    [Fact]
    public void Draw_AcrossAllIndices_ShouldOfferEachCardExactlySixMinusDealtTimes()
    {
        var dealt = TestCards.Hand("AS", "AS", "KD");
        var remaining = ShoeCardSource.Decks * Card.DeckSize - dealt.Count;
        var counts = new Dictionary<int, int>();

        for (var index = 0; index < remaining; index++)
        {
            var card = new ShoeCardSource(new IndexRandom(index)).Draw(dealt);
            counts[card.Code] = counts.GetValueOrDefault(card.Code) + 1;
        }

        Assert.Equal(4, counts[TestCards.Parse("AS").Code]);
        Assert.Equal(5, counts[TestCards.Parse("KD").Code]);
        Assert.Equal(6, counts[TestCards.Parse("2H").Code]);
        Assert.Equal(Card.DeckSize, counts.Count);
        Assert.Equal(remaining, counts.Values.Sum());
    }

    [Fact]
    public void Draw_FromFreshShoe_ShouldReachBothEnds()
    {
        Assert.Equal(0, new ShoeCardSource(new IndexRandom(0)).Draw([]).Code);
        Assert.Equal(51, new ShoeCardSource(new IndexRandom(311)).Draw([]).Code);
    }
}

using AuctionServer.Modules.Casino.Domain.Cards;

namespace AuctionServer.Modules.Casino.Tests.Domain.Cards;

public static class TestCards
{
    public static Card Parse(string card)
    {
        var rank = card[..^1] switch
        {
            "A" => 0,
            "10" or "T" => 9,
            "J" => 10,
            "Q" => 11,
            "K" => 12,
            var number => int.Parse(number) - 1
        };
        var suit = card[^1] switch
        {
            'S' => 0,
            'H' => 1,
            'D' => 2,
            'C' => 3,
            _ => throw new ArgumentException($"Unknown suit in '{card}'", nameof(card))
        };
        return new Card(suit * 13 + rank);
    }

    public static List<Card> Hand(params string[] cards) => cards.Select(Parse).ToList();
}
